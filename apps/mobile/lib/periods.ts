/** Period helpers for personal stats (default = focused calendar month). */

export type PeriodPreset = 'month' | 'year' | 'custom';

/** Focused month/year for Monthly and Yearly navigation. Month is 1–12. */
export type PeriodFocus = {
  year: number;
  month: number;
};

export type PeriodBounds = {
  preset: PeriodPreset;
  start: Date;
  end: Date;
  /** Full range label (drill-down, accessibility). */
  label: string;
  /** Compact center label for Monthly / Yearly top nav. */
  navLabel: string;
};

export type TrendBucket = 'day' | 'week' | 'month' | 'year';

/**
 * Allow-list for `stats_personal_trend.p_bucket` (must stay in sync with
 * supabase migrations `*_stats_trend_year_*.sql`). Yearly Trend sends `year`.
 */
export const TREND_RPC_BUCKETS = [
  'day',
  'week',
  'month',
  'year',
] as const satisfies readonly TrendBucket[];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Parts of `date` in an IANA timezone (fallback: device local). */
function zonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; weekday: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    });
    const parts = fmt.formatToParts(date);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? '';
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return {
      year: Number(get('year')),
      month: Number(get('month')),
      day: Number(get('day')),
      weekday: weekdayMap[get('weekday')] ?? date.getDay(),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: date.getDay(),
    };
  }
}

/**
 * Approximate instant for local midnight on Y-M-D in `timeZone`.
 * Good enough for period filters (bounds are inclusive start / exclusive end).
 */
function zonedMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  try {
    const wall = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(utcGuess);
    const num = (type: string) =>
      Number(wall.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
      num('year'),
      num('month') - 1,
      num('day'),
      num('hour'),
      num('minute'),
      num('second')
    );
    const offsetMs = asUtc - utcGuess.getTime();
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMs);
  } catch {
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
}

function addDays(year: number, month: number, day: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function formatRangeLabel(start: Date, endExclusive: Date, timeZone: string): string {
  const endInclusive = new Date(endExclusive.getTime() - 1);
  const opts: Intl.DateTimeFormatOptions = {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  try {
    const a = start.toLocaleDateString(undefined, opts);
    const b = endInclusive.toLocaleDateString(undefined, opts);
    return a === b ? a : `${a} – ${b}`;
  } catch {
    return `${start.toISOString().slice(0, 10)} – ${endInclusive.toISOString().slice(0, 10)}`;
  }
}

function monthNavLabel(focus: PeriodFocus, timeZone: string, now: Date): string {
  const name = MONTH_NAMES[focus.month - 1] ?? `M${focus.month}`;
  const current = zonedParts(now, timeZone);
  // Include year when the focused month is outside the current calendar year.
  if (focus.year !== current.year) {
    return `${name} ${focus.year}`;
  }
  return name;
}

/** Current calendar month/year in the account timezone. */
export function currentPeriodFocus(
  timeZone: string,
  now: Date = new Date()
): PeriodFocus {
  const parts = zonedParts(now, timeZone);
  return { year: parts.year, month: parts.month };
}

/** Step focused month (±1) or year (±1). */
export function shiftPeriodFocus(
  focus: PeriodFocus,
  preset: 'month' | 'year',
  delta: number
): PeriodFocus {
  if (preset === 'year') {
    return { year: focus.year + delta, month: focus.month };
  }
  const idx = focus.year * 12 + (focus.month - 1) + delta;
  const year = Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return { year, month };
}

/** Compact date for Period mode fields — e.g. `1/1/26`. */
export function formatCompactDate(date: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(date, timeZone);
  const yy = String(year).slice(-2);
  return `${month}/${day}/${yy}`;
}

export function periodModeLabel(preset: PeriodPreset): string {
  switch (preset) {
    case 'month':
      return 'Monthly';
    case 'year':
      return 'Yearly';
    case 'custom':
      return 'Period';
  }
}

export function periodModeOptions(): { value: PeriodPreset; label: string }[] {
  return [
    { value: 'month', label: 'Monthly' },
    { value: 'year', label: 'Yearly' },
    { value: 'custom', label: 'Period' },
  ];
}

/** Default / mode period bounds in the account timezone. End is exclusive. */
export function resolvePeriodBounds(
  preset: PeriodPreset,
  timeZone: string,
  options?: {
    focus?: PeriodFocus;
    customStart?: Date;
    customEndInclusive?: Date;
    now?: Date;
  }
): PeriodBounds {
  const now = options?.now ?? new Date();
  const focus = options?.focus ?? currentPeriodFocus(timeZone, now);

  if (preset === 'custom') {
    const customStart = options?.customStart;
    const customEndInclusive = options?.customEndInclusive;
    if (!customStart || !customEndInclusive) {
      return resolvePeriodBounds('month', timeZone, { focus, now });
    }
    const s = zonedParts(customStart, timeZone);
    const e = zonedParts(customEndInclusive, timeZone);
    const start = zonedMidnight(s.year, s.month, s.day, timeZone);
    const endDay = addDays(e.year, e.month, e.day, 1);
    const end = zonedMidnight(endDay.year, endDay.month, endDay.day, timeZone);
    const label = formatRangeLabel(start, end, timeZone);
    return {
      preset: 'custom',
      start,
      end,
      label,
      navLabel: label,
    };
  }

  if (preset === 'year') {
    const start = zonedMidnight(focus.year, 1, 1, timeZone);
    const end = zonedMidnight(focus.year + 1, 1, 1, timeZone);
    const navLabel = String(focus.year);
    return {
      preset: 'year',
      start,
      end,
      label: formatRangeLabel(start, end, timeZone),
      navLabel,
    };
  }

  // month (default)
  const start = zonedMidnight(focus.year, focus.month, 1, timeZone);
  const endMonth = focus.month === 12 ? 1 : focus.month + 1;
  const endYear = focus.month === 12 ? focus.year + 1 : focus.year;
  const end = zonedMidnight(endYear, endMonth, 1, timeZone);
  return {
    preset: 'month',
    start,
    end,
    label: formatRangeLabel(start, end, timeZone),
    navLabel: monthNavLabel(focus, timeZone, now),
  };
}

/** How many month nodes the Monthly Trend series ends at the focused month. */
export const TREND_MONTHLY_POINTS = 12;
/** How many year nodes the Yearly Trend series ends at the focused year. */
export const TREND_YEARLY_POINTS = 5;

/**
 * Trend node grain = selected period mode:
 * - Monthly → one node per month total
 * - Yearly → one node per year total
 * - Period (custom) → smart default by range length:
 *   ≤45 days → day; ≤183 days → week; else → month
 *
 * Pair with `resolveTrendBounds` so Monthly/Yearly query enough history
 * for multiple nodes (a single focused month/year alone collapses to ≤1 point).
 */
export function trendBucketForPeriod(
  start: Date,
  end: Date,
  preset?: PeriodPreset
): TrendBucket {
  if (preset === 'month') return 'month';
  if (preset === 'year') return 'year';

  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 45) return 'day';
  if (days <= 183) return 'week';
  return 'month';
}

/**
 * Date window for the Trend RPC. Pie/totals keep `period`; Trend widens so
 * Monthly can plot trailing months and Yearly trailing years ending at focus.
 * Custom Period uses the selected range as-is.
 */
export function resolveTrendBounds(
  period: PeriodBounds,
  timeZone: string,
  options?: {
    focus?: PeriodFocus;
    monthCount?: number;
    yearCount?: number;
  }
): { start: Date; end: Date } {
  if (period.preset === 'custom') {
    return { start: period.start, end: period.end };
  }

  const startParts = zonedParts(period.start, timeZone);
  const focus =
    options?.focus ??
    (period.preset === 'year'
      ? { year: startParts.year, month: 1 }
      : { year: startParts.year, month: startParts.month });

  if (period.preset === 'year') {
    const count = Math.max(1, options?.yearCount ?? TREND_YEARLY_POINTS);
    const first = shiftPeriodFocus(focus, 'year', -(count - 1));
    const start = resolvePeriodBounds('year', timeZone, { focus: first }).start;
    return { start, end: period.end };
  }

  // month
  const count = Math.max(1, options?.monthCount ?? TREND_MONTHLY_POINTS);
  const first = shiftPeriodFocus(focus, 'month', -(count - 1));
  const start = resolvePeriodBounds('month', timeZone, { focus: first }).start;
  return { start, end: period.end };
}

/** Compact X-axis tick for a trend bucket start. */
export function formatTrendBucketLabel(
  bucketStartIso: string,
  bucket: TrendBucket,
  timeZone: string
): string {
  const date = new Date(bucketStartIso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    if (bucket === 'year') {
      return date.toLocaleDateString(undefined, {
        timeZone,
        year: 'numeric',
      });
    }
    if (bucket === 'month') {
      // Include year — Monthly Trend spans ~12 months across year boundaries.
      return date.toLocaleDateString(undefined, {
        timeZone,
        month: 'short',
        year: '2-digit',
      });
    }
    // day or week — show calendar date of the bucket start
    return date.toLocaleDateString(undefined, {
      timeZone,
      month: 'short',
      day: 'numeric',
    });
  } catch {
    if (bucket === 'year') return String(date.getUTCFullYear());
    if (bucket === 'month') {
      const name = MONTH_NAMES[date.getUTCMonth()]?.slice(0, 3) ?? '';
      const yy = String(date.getUTCFullYear()).slice(-2);
      return name ? `${name} ${yy}` : yy;
    }
    return bucketStartIso.slice(0, 10);
  }
}
