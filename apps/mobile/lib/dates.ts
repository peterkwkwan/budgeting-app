/**
 * Calendar-day helpers in an IANA timezone (profile / device).
 * Used for “recurring visible when local date <= today”.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export type LocalYmd = { year: number; month: number; day: number };

/** Civil Y-M-D parts of an instant in `timeZone`. */
export function zonedYmd(date: Date, timeZone: string): LocalYmd {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = fmt.formatToParts(date);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
}

export function ymdKey(ymd: LocalYmd): string {
  return `${ymd.year}-${pad2(ymd.month)}-${pad2(ymd.day)}`;
}

export function localDateKey(
  isoOrDate: string | Date,
  timeZone: string
): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  return ymdKey(zonedYmd(d, timeZone));
}

/** True when the event’s local calendar day is on or before today’s local day. */
export function isOnOrBeforeLocalToday(
  occurredAt: string,
  timeZone: string,
  now: Date = new Date()
): boolean {
  const eventKey = localDateKey(occurredAt, timeZone);
  const todayKey = localDateKey(now, timeZone);
  if (!eventKey || !todayKey) return false;
  return eventKey <= todayKey;
}

/** Exclusive start of tomorrow (local midnight) as a Date for bounds checks. */
export function startOfTomorrow(timeZone: string, now: Date = new Date()): Date {
  const today = zonedYmd(now, timeZone);
  const utcGuess = new Date(Date.UTC(today.year, today.month - 1, today.day + 1, 12, 0, 0));
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
    return new Date(
      Date.UTC(today.year, today.month - 1, today.day + 1, 0, 0, 0) - offsetMs
    );
  } catch {
    return new Date(today.year, today.month - 1, today.day + 1, 0, 0, 0, 0);
  }
}

export function currentMonthBounds(
  timeZone: string,
  now: Date = new Date()
): { start: Date; end: Date; ymd: LocalYmd } {
  const parts = zonedYmd(now, timeZone);
  const start = zonedMidnight(parts.year, parts.month, 1, timeZone);
  const endMonth = parts.month === 12 ? 1 : parts.month + 1;
  const endYear = parts.month === 12 ? parts.year + 1 : parts.year;
  const end = zonedMidnight(endYear, endMonth, 1, timeZone);
  return { start, end, ymd: parts };
}

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
