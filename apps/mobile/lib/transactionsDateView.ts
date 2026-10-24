/**
 * Helpers for Transactions date layouts (list by day / week strip / month calendar).
 */

import {
  formatDisplayDate,
  localDateKey,
  zonedYmd,
  type LocalYmd,
} from './dates';
import { formatCompactUsd, formatUsd } from './money';
import type { PeriodFocus } from './periods';
import type { Transaction } from './transactions';

export type DaySection = {
  key: string;
  title: string;
  data: Transaction[];
};

/** Days in a calendar month (1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Weekday 0=Sun … 6=Sat for Y-M-D (civil calendar, timezone-agnostic). */
export function weekdaySun0(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Monday-start index 0=Mon … 6=Sun. */
export function weekdayMon0(year: number, month: number, day: number): number {
  return (weekdaySun0(year, month, day) + 6) % 7;
}

export function clampDayInMonth(
  year: number,
  month: number,
  day: number
): number {
  const max = daysInMonth(year, month);
  return Math.min(Math.max(1, day), max);
}

/** Prefer today when it falls in the focused month; otherwise day 1. */
export function defaultSelectedDay(
  focus: PeriodFocus,
  timeZone: string,
  now: Date = new Date()
): number {
  const today = zonedYmd(now, timeZone);
  if (today.year === focus.year && today.month === focus.month) {
    return today.day;
  }
  return 1;
}

export function ymdFromFocusDay(
  focus: PeriodFocus,
  day: number
): LocalYmd {
  return {
    year: focus.year,
    month: focus.month,
    day: clampDayInMonth(focus.year, focus.month, day),
  };
}

export function dateKeyFromFocusDay(focus: PeriodFocus, day: number): string {
  const ymd = ymdFromFocusDay(focus, day);
  const m = String(ymd.month).padStart(2, '0');
  const d = String(ymd.day).padStart(2, '0');
  return `${ymd.year}-${m}-${d}`;
}

/** Heading like `Thursday, October 23` for a civil day in the focused month. */
export function formatFocusDayHeading(
  focus: PeriodFocus,
  day: number,
  timeZone: string
): string {
  const ymd = ymdFromFocusDay(focus, day);
  // Noon UTC avoids DST edge cases for pure calendar labels.
  const iso = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12, 0, 0));
  return formatDisplayDate(iso, timeZone);
}

/** Group visible month transactions under sticky day headings (newest day first). */
export function groupTransactionsByDay(
  rows: Transaction[],
  timeZone: string
): DaySection[] {
  const map = new Map<string, Transaction[]>();
  for (const row of rows) {
    const key = localDateKey(row.occurred_at, timeZone);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }

  const keys = [...map.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  return keys.map((key) => {
    const data = map.get(key) ?? [];
    const title = data[0]
      ? formatDisplayDate(data[0].occurred_at, timeZone)
      : key;
    return { key, title, data };
  });
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function signedAmount(row: Transaction): number {
  return row.type === 'expense' ? -row.amount : row.amount;
}

/**
 * Net of a day's rows: income adds, expenses subtract.
 * `null` when there are no rows. Rounded to cents.
 */
export function netOfTransactions(
  rows: readonly Transaction[]
): number | null {
  if (rows.length === 0) return null;
  let net = 0;
  for (const row of rows) net += signedAmount(row);
  return roundCents(net);
}

/**
 * Day-of-month → net for rows that fall in `focus` (account timezone).
 * Days with transactions are present even when the net is zero.
 */
export function dayNetsInMonth(
  rows: readonly Transaction[],
  focus: PeriodFocus,
  timeZone: string
): Map<number, number> {
  const acc = new Map<number, number>();
  for (const row of rows) {
    const key = localDateKey(row.occurred_at, timeZone);
    if (!key) continue;
    const [y, m, d] = key.split('-').map(Number);
    if (y !== focus.year || m !== focus.month || !(d >= 1)) continue;
    acc.set(d, (acc.get(d) ?? 0) + signedAmount(row));
  }
  for (const [day, net] of acc) acc.set(day, roundCents(net));
  return acc;
}

export type DayNetTone = 'income' | 'expense' | 'zero';

/**
 * Signed USD label for a day net.
 * Positive `+$12.50` (income), negative `−$18.75` (expense), zero `$0.00`.
 * `compact` abbreviates amounts at or above $1,000 so calendar chips fit.
 */
export function formatDayNet(
  net: number,
  opts?: { compact?: boolean }
): { text: string; tone: DayNetTone } {
  const tone: DayNetTone =
    net > 0 ? 'income' : net < 0 ? 'expense' : 'zero';
  const compact = Boolean(opts?.compact) && Math.abs(net) >= 1000;
  const body = compact ? formatCompactUsd(Math.abs(net)) : formatUsd(net);
  if (net > 0) return { text: `+${body}`, tone };
  if (net < 0) return { text: `−${body}`, tone };
  return { text: body, tone };
}

export function filterTransactionsForDay(
  rows: Transaction[],
  focus: PeriodFocus,
  day: number,
  timeZone: string
): Transaction[] {
  const want = dateKeyFromFocusDay(focus, day);
  return rows.filter(
    (row) => localDateKey(row.occurred_at, timeZone) === want
  );
}

/** Mon–Sun week containing `day` in the focused month (may spill outside month). */
export function weekDaysAround(
  focus: PeriodFocus,
  day: number
): { year: number; month: number; day: number; inFocusMonth: boolean }[] {
  const clamped = clampDayInMonth(focus.year, focus.month, day);
  const monOffset = weekdayMon0(focus.year, focus.month, clamped);
  const start = new Date(
    Date.UTC(focus.year, focus.month - 1, clamped - monOffset)
  );
  const out: {
    year: number;
    month: number;
    day: number;
    inFocusMonth: boolean;
  }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime());
    d.setUTCDate(start.getUTCDate() + i);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const dayNum = d.getUTCDate();
    out.push({
      year,
      month,
      day: dayNum,
      inFocusMonth: year === focus.year && month === focus.month,
    });
  }
  return out;
}

/** Sunday-start month grid cells (null = empty pad). */
export function monthGridCells(
  focus: PeriodFocus
): (number | null)[] {
  const startPad = weekdaySun0(focus.year, focus.month, 1);
  const count = daysInMonth(focus.year, focus.month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const WEEKDAY_LETTERS_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const WEEKDAY_LETTERS_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
