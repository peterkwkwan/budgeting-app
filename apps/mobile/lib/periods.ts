/** Period helpers for personal stats (default = this calendar month). */

export type PeriodPreset = 'week' | 'month' | 'year' | 'custom';

export type PeriodBounds = {
  preset: PeriodPreset;
  start: Date;
  end: Date;
  label: string;
};

export type TrendBucket = 'day' | 'week' | 'month';

const PRESET_LABELS: Record<Exclude<PeriodPreset, 'custom'>, string> = {
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

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

/** Default / preset period bounds in the account timezone. End is exclusive. */
export function resolvePeriodBounds(
  preset: PeriodPreset,
  timeZone: string,
  customStart?: Date,
  customEndInclusive?: Date
): PeriodBounds {
  const now = new Date();
  const parts = zonedParts(now, timeZone);

  if (preset === 'custom') {
    if (!customStart || !customEndInclusive) {
      return resolvePeriodBounds('month', timeZone);
    }
    const s = zonedParts(customStart, timeZone);
    const e = zonedParts(customEndInclusive, timeZone);
    const start = zonedMidnight(s.year, s.month, s.day, timeZone);
    const endDay = addDays(e.year, e.month, e.day, 1);
    const end = zonedMidnight(endDay.year, endDay.month, endDay.day, timeZone);
    return {
      preset: 'custom',
      start,
      end,
      label: formatRangeLabel(start, end, timeZone),
    };
  }

  if (preset === 'week') {
    const daysFromMonday = (parts.weekday + 6) % 7;
    const startDay = addDays(parts.year, parts.month, parts.day, -daysFromMonday);
    const endDay = addDays(startDay.year, startDay.month, startDay.day, 7);
    const start = zonedMidnight(startDay.year, startDay.month, startDay.day, timeZone);
    const end = zonedMidnight(endDay.year, endDay.month, endDay.day, timeZone);
    return { preset, start, end, label: PRESET_LABELS.week };
  }

  if (preset === 'year') {
    const start = zonedMidnight(parts.year, 1, 1, timeZone);
    const end = zonedMidnight(parts.year + 1, 1, 1, timeZone);
    return { preset, start, end, label: PRESET_LABELS.year };
  }

  // month (default)
  const start = zonedMidnight(parts.year, parts.month, 1, timeZone);
  const endMonth = parts.month === 12 ? 1 : parts.month + 1;
  const endYear = parts.month === 12 ? parts.year + 1 : parts.year;
  const end = zonedMidnight(endYear, endMonth, 1, timeZone);
  return { preset: 'month', start, end, label: PRESET_LABELS.month };
}

/** Pick trend bucket size from period length. */
export function trendBucketForPeriod(start: Date, end: Date): TrendBucket {
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 45) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

export function periodPresetOptions(): { value: PeriodPreset; label: string }[] {
  return [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'custom', label: 'Custom' },
  ];
}
