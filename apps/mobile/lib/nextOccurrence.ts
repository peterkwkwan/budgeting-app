/**
 * Next civil date a recurring series will occur.
 * Cadence, weekday filter, month-end clamp, and end rules match
 * supabase/functions/_shared/recurring.ts (enumerateFromAnchor).
 */
import { formatDisplayDate, ymdKey, zonedYmd, type LocalYmd } from './dates';

export type NextOccurrenceInput = {
  cadence: 'daily' | 'weekly' | 'monthly' | 'yearly';
  byweekday: number[] | null;
  anchor_at: string;
  timezone: string;
  ends_on: string | null;
  ends_after_count: number | null;
};

function compareYmd(a: LocalYmd, b: LocalYmd): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function parseYmd(raw: string | null | undefined): LocalYmd | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function weekdayOfYmd(y: LocalYmd): number {
  return new Date(Date.UTC(y.year, y.month - 1, y.day, 12, 0, 0)).getUTCDay();
}

function addDays(y: LocalYmd, days: number): LocalYmd {
  const d = new Date(Date.UTC(y.year, y.month - 1, y.day + days, 12, 0, 0));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function clampDay(year: number, month: number, day: number): LocalYmd {
  return { year, month, day: Math.min(day, daysInMonth(year, month)) };
}

function daysBetween(a: LocalYmd, b: LocalYmd): number {
  const ua = Date.UTC(a.year, a.month - 1, a.day);
  const ub = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((ub - ua) / 86_400_000);
}

function weekdayMask(raw: number[] | null): Set<number> | null {
  if (!raw || raw.length === 0) return null;
  const set = new Set<number>();
  for (const n of raw) {
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  return set.size > 0 ? set : null;
}

function maxYmd(a: LocalYmd, b: LocalYmd): LocalYmd {
  return compareYmd(a, b) >= 0 ? a : b;
}

type Schedule = {
  cadence: NextOccurrenceInput['cadence'];
  anchor: LocalYmd;
  mask: Set<number> | null;
  endsOn: LocalYmd | null;
};

/** First matching civil date on or after `from`, or null if the series has ended. */
function firstOnOrAfter(schedule: Schedule, from: LocalYmd): LocalYmd | null {
  const { cadence, anchor, mask, endsOn } = schedule;
  const start = maxYmd(from, anchor);

  const accept = (d: LocalYmd): LocalYmd | null => {
    if (endsOn && compareYmd(d, endsOn) > 0) return null;
    return d;
  };

  if (cadence === 'daily' || cadence === 'weekly') {
    const days: Set<number> | null =
      cadence === 'weekly' ? (mask ?? new Set([weekdayOfYmd(anchor)])) : mask;
    let cur = start;
    for (let i = 0; i < 7; i++) {
      const weekday = weekdayOfYmd(cur);
      const matches =
        days == null ? cadence === 'daily' : days.has(weekday);
      if (matches) return accept(cur);
      cur = addDays(cur, 1);
    }
    return null;
  }

  if (cadence === 'monthly') {
    let y = start.year;
    let m = start.month;
    for (let i = 0; i < 2; i++) {
      const cand = clampDay(y, m, anchor.day);
      if (compareYmd(cand, anchor) >= 0 && compareYmd(cand, start) >= 0) {
        return accept(cand);
      }
      const next = addMonths(y, m, 1);
      y = next.year;
      m = next.month;
    }
    return null;
  }

  if (cadence === 'yearly') {
    let y = start.year;
    for (let i = 0; i < 2; i++) {
      const cand = clampDay(y, anchor.month, anchor.day);
      if (compareYmd(cand, anchor) >= 0 && compareYmd(cand, start) >= 0) {
        return accept(cand);
      }
      y += 1;
    }
    return null;
  }

  return null;
}

/** 0-based index for cadences that hit once per day, month, or year. */
function simpleIndex(
  cadence: NextOccurrenceInput['cadence'],
  anchor: LocalYmd,
  date: LocalYmd
): number {
  if (cadence === 'daily') return daysBetween(anchor, date);
  if (cadence === 'monthly') {
    return (date.year - anchor.year) * 12 + (date.month - anchor.month);
  }
  return date.year - anchor.year;
}

/**
 * Upcoming occurrence as YYYY-MM-DD in the series timezone.
 * Includes today when the rule occurs today. Null when the series has ended
 * or the anchor instant is invalid.
 */
export function nextOccurrenceYmd(
  series: NextOccurrenceInput,
  now: Date = new Date()
): string | null {
  const anchorDate = new Date(series.anchor_at);
  if (Number.isNaN(anchorDate.getTime())) return null;

  const tz = series.timezone || 'UTC';
  const anchor = zonedYmd(anchorDate, tz);
  const today = zonedYmd(now, tz);
  const schedule: Schedule = {
    cadence: series.cadence,
    anchor,
    mask: weekdayMask(series.byweekday),
    endsOn: parseYmd(series.ends_on),
  };
  const count =
    series.ends_after_count != null &&
    Number.isInteger(series.ends_after_count) &&
    series.ends_after_count >= 1
      ? series.ends_after_count
      : null;

  const needsWalk =
    count != null &&
    (series.cadence === 'weekly' ||
      (series.cadence === 'daily' && schedule.mask != null));

  if (!needsWalk) {
    const next = firstOnOrAfter(schedule, today);
    if (!next) return null;
    if (count != null && simpleIndex(series.cadence, anchor, next) >= count) {
      return null;
    }
    return ymdKey(next);
  }

  let cursor = anchor;
  for (let n = 0; n < count; n++) {
    const occ = firstOnOrAfter(schedule, cursor);
    if (!occ) return null;
    if (compareYmd(occ, today) >= 0) return ymdKey(occ);
    cursor = addDays(occ, 1);
  }
  return null;
}

/** List label for the next occurrence. Adds the year when it is not this year. */
export function nextOccurrenceLabel(
  series: NextOccurrenceInput,
  now: Date = new Date()
): string | null {
  const ymd = nextOccurrenceYmd(series, now);
  if (!ymd) return null;
  const today = zonedYmd(now, series.timezone || 'UTC');
  const label = formatDisplayDate(`${ymd}T12:00:00.000Z`, 'UTC');
  if (ymd.slice(0, 4) !== String(today.year)) {
    return `${label}, ${ymd.slice(0, 4)}`;
  }
  return label;
}
