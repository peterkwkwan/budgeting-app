/**
 * Shared recurring generation for generate-recurring (cron) and
 * catch-up-recurring (callable). Rolling window: [now-90d, now+90d]
 * clipped by series.anchor_at and end conditions (ends_on / ends_after_count).
 * Idempotent via occurrence_key.
 */

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecurringSeriesRow = {
  id: string;
  user_id: string;
  amount: number | string;
  type: 'expense' | 'income';
  category: string;
  note: string | null;
  cadence: Cadence;
  /** 0=Sun … 6=Sat; null = no weekday filter (weekly defaults to anchor weekday). */
  byweekday: number[] | null;
  anchor_at: string;
  timezone: string;
  active: boolean;
  /** Inclusive end as YYYY-MM-DD (date column) or null. */
  ends_on: string | null;
  ends_after_count: number | null;
};

export type GeneratedOccurrence = {
  user_id: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  note: string | null;
  currency: 'USD';
  occurred_at: string;
  recurring_series_id: string;
  occurrence_key: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const HORIZON_DAYS = 90;
/** Safety cap when walking from anchor for ends_after_count. */
const MAX_OCCURRENCES = 800;

type Ymd = { year: number; month: number; day: number };

type ZonedParts = Ymd & {
  hour: number;
  minute: number;
  second: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

export function zonedTimeToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  },
  timeZone: string
): Date {
  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  const second = parts.second ?? 0;
  let utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    hour,
    minute,
    second
  );
  for (let i = 0; i < 3; i++) {
    const asZoned = getZonedParts(new Date(utc), timeZone);
    const asUtcGuess = Date.UTC(
      asZoned.year,
      asZoned.month - 1,
      asZoned.day,
      asZoned.hour,
      asZoned.minute,
      asZoned.second
    );
    const desired = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      hour,
      minute,
      second
    );
    utc += desired - asUtcGuess;
  }
  return new Date(utc);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function ymdKey(y: Ymd): string {
  return `${y.year}-${pad2(y.month)}-${pad2(y.day)}`;
}

function compareYmd(a: Ymd, b: Ymd): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function maxYmd(a: Ymd, b: Ymd): Ymd {
  return compareYmd(a, b) >= 0 ? a : b;
}

function minYmd(a: Ymd, b: Ymd): Ymd {
  return compareYmd(a, b) <= 0 ? a : b;
}

function parseEndsOn(raw: string | null | undefined): Ymd | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw));
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

function weekdayOfYmd(y: Ymd): number {
  return new Date(Date.UTC(y.year, y.month - 1, y.day, 12, 0, 0)).getUTCDay();
}

function addDaysYmd(y: Ymd, days: number): Ymd {
  const d = new Date(Date.UTC(y.year, y.month - 1, y.day + days, 12, 0, 0));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function addMonths(year: number, month: number, delta: number): Ymd {
  const idx = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(idx / 12),
    month: (idx % 12) + 1,
    day: 1,
  };
}

function occurrenceInMonth(
  year: number,
  month: number,
  anchorDay: number
): Ymd {
  return {
    year,
    month,
    day: Math.min(anchorDay, daysInMonth(year, month)),
  };
}

function normalizeByweekday(
  raw: number[] | null | undefined
): Set<number> | null {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
  const set = new Set<number>();
  for (const n of raw) {
    const v = Number(n);
    if (Number.isInteger(v) && v >= 0 && v <= 6) set.add(v);
  }
  return set.size > 0 ? set : null;
}

/** All occurrence civil dates from anchor through upper (inclusive), cadence-aware. */
function enumerateFromAnchor(
  series: RecurringSeriesRow,
  anchorYmd: Ymd,
  upper: Ymd,
  anchorDayOfMonth: number,
  anchorMonth: number
): Ymd[] {
  const weekdayMask = normalizeByweekday(series.byweekday);
  const dates: Ymd[] = [];

  if (series.cadence === 'daily') {
    let cur = { ...anchorYmd };
    let n = 0;
    while (compareYmd(cur, upper) <= 0 && n < MAX_OCCURRENCES) {
      if (!weekdayMask || weekdayMask.has(weekdayOfYmd(cur))) {
        dates.push({ ...cur });
        n += 1;
      }
      cur = addDaysYmd(cur, 1);
    }
  } else if (series.cadence === 'weekly') {
    const days =
      weekdayMask ?? new Set([weekdayOfYmd(anchorYmd)]);
    let cur = { ...anchorYmd };
    let n = 0;
    while (compareYmd(cur, upper) <= 0 && n < MAX_OCCURRENCES) {
      if (days.has(weekdayOfYmd(cur))) {
        dates.push({ ...cur });
        n += 1;
      }
      cur = addDaysYmd(cur, 1);
    }
  } else if (series.cadence === 'monthly') {
    let y = anchorYmd.year;
    let m = anchorYmd.month;
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const cand = occurrenceInMonth(y, m, anchorDayOfMonth);
      if (compareYmd(cand, anchorYmd) >= 0 && compareYmd(cand, upper) <= 0) {
        dates.push(cand);
      }
      if (compareYmd(cand, upper) > 0 || (y > upper.year || (y === upper.year && m >= upper.month))) {
        if (y > upper.year || (y === upper.year && m > upper.month)) break;
        if (y === upper.year && m === upper.month && compareYmd(cand, upper) > 0) break;
      }
      const next = addMonths(y, m, 1);
      y = next.year;
      m = next.month;
      if (y > upper.year + 1) break;
    }
  } else if (series.cadence === 'yearly') {
    for (
      let y = anchorYmd.year;
      y <= upper.year && dates.length < MAX_OCCURRENCES;
      y++
    ) {
      const cand = occurrenceInMonth(y, anchorMonth, anchorDayOfMonth);
      if (compareYmd(cand, anchorYmd) >= 0 && compareYmd(cand, upper) <= 0) {
        dates.push(cand);
      }
    }
  }

  return dates;
}

/**
 * Enumerate occurrence local dates for a series inside the rolling window,
 * respecting ends_on and ends_after_count.
 */
export function enumerateOccurrences(
  series: RecurringSeriesRow,
  now: Date = new Date()
): GeneratedOccurrence[] {
  const tz = series.timezone || 'UTC';
  const anchor = new Date(series.anchor_at);
  if (Number.isNaN(anchor.getTime())) {
    return [];
  }

  const anchorParts = getZonedParts(anchor, tz);
  const anchorYmd: Ymd = {
    year: anchorParts.year,
    month: anchorParts.month,
    day: anchorParts.day,
  };

  const windowStart = getZonedParts(
    new Date(now.getTime() - HORIZON_DAYS * MS_PER_DAY),
    tz
  );
  const windowEnd = getZonedParts(
    new Date(now.getTime() + HORIZON_DAYS * MS_PER_DAY),
    tz
  );

  const endsOn = parseEndsOn(series.ends_on);
  let upper: Ymd = {
    year: windowEnd.year,
    month: windowEnd.month,
    day: windowEnd.day,
  };
  if (endsOn) {
    upper = minYmd(upper, endsOn);
  }

  const lower = maxYmd(anchorYmd, {
    year: windowStart.year,
    month: windowStart.month,
    day: windowStart.day,
  });

  if (compareYmd(lower, upper) > 0) {
    return [];
  }

  // Walk from anchor through upper so ends_after_count indexes correctly.
  let all = enumerateFromAnchor(
    series,
    anchorYmd,
    upper,
    anchorParts.day,
    anchorParts.month
  );

  const afterCount =
    series.ends_after_count != null && Number(series.ends_after_count) >= 1
      ? Number(series.ends_after_count)
      : null;
  if (afterCount != null) {
    all = all.slice(0, afterCount);
  }

  const tod = {
    hour: anchorParts.hour,
    minute: anchorParts.minute,
    second: anchorParts.second,
  };

  const seen = new Set<string>();
  const out: GeneratedOccurrence[] = [];
  for (const d of all) {
    if (compareYmd(d, lower) < 0 || compareYmd(d, upper) > 0) continue;
    const key = ymdKey(d);
    if (seen.has(key)) continue;
    seen.add(key);
    const occurred = zonedTimeToUtc({ ...d, ...tod }, tz);
    out.push({
      user_id: series.user_id,
      amount: Number(series.amount),
      type: series.type,
      category: series.category,
      note: series.note,
      currency: 'USD',
      occurred_at: occurred.toISOString(),
      recurring_series_id: series.id,
      occurrence_key: key,
    });
  }
  return out;
}

export type GenerateResult = {
  seriesProcessed: number;
  attempted: number;
  inserted: number;
  errors: string[];
};

export async function generateForSeriesList(
  // deno-lint-ignore no-explicit-any
  client: any,
  seriesList: RecurringSeriesRow[],
  now: Date = new Date()
): Promise<GenerateResult> {
  const result: GenerateResult = {
    seriesProcessed: 0,
    attempted: 0,
    inserted: 0,
    errors: [],
  };

  for (const series of seriesList) {
    result.seriesProcessed += 1;
    let rows: GeneratedOccurrence[];
    try {
      rows = enumerateOccurrences(series, now);
    } catch (err) {
      result.errors.push(
        `${series.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }
    if (rows.length === 0) continue;
    result.attempted += rows.length;

    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error, data } = await client
        .from('transactions')
        .upsert(chunk, {
          onConflict: 'recurring_series_id,occurrence_key',
          ignoreDuplicates: true,
        })
        .select('id');

      if (error) {
        result.errors.push(`${series.id}: ${error.message}`);
        break;
      }
      result.inserted += Array.isArray(data) ? data.length : 0;
    }
  }

  return result;
}
