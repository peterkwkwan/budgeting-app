/**
 * Pure transaction shapes, validation, and list visibility.
 * Shared by the Supabase adapter and the offline repository.
 * No network and no SQLite.
 */
import type { TransactionType } from '@/constants/categories';
import {
  formatDisplayDate,
  isOnOrBeforeLocalToday,
  localDateKey,
} from '@/lib/dates';
import {
  currentPeriodFocus,
  resolvePeriodBounds,
  type PeriodFocus,
} from '@/lib/periods';

export type Transaction = {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category: string;
  note: string | null;
  currency: string;
  occurred_at: string;
  recurring_series_id: string | null;
  occurrence_key: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionInput = {
  amount: number;
  type: TransactionType;
  category: string;
  note?: string | null;
  occurred_at: string;
};

export type TransactionBulkPatch = {
  occurred_at?: string;
  category?: string;
  note?: string | null;
};

export function validateTransactionInput(input: TransactionInput): string | null {
  if (!(input.amount > 0) || Number.isNaN(input.amount)) {
    return 'Amount must be greater than zero.';
  }
  if (input.type !== 'expense' && input.type !== 'income') {
    return 'Type must be expense or income.';
  }
  const category = input.category?.trim() ?? '';
  if (!category || category.length > 40) {
    return 'Pick a category.';
  }
  const note = input.note?.trim() ?? '';
  if (note.length > 500) {
    return 'Note must be 500 characters or fewer.';
  }
  if (!input.occurred_at) {
    return 'Date is required.';
  }
  return null;
}

/**
 * Field snapshot for one bulk-edit row. Category is trimmed the same way
 * the remote bulk patch always saved it.
 */
export function inputFromBulkPatch(
  row: Transaction,
  patch: TransactionBulkPatch
): TransactionInput {
  const category = (patch.category ?? row.category).trim();
  if (patch.category !== undefined && !category) {
    throw new Error('Pick a category.');
  }
  return {
    amount: row.amount,
    type: row.type,
    category,
    note: patch.note !== undefined ? patch.note : row.note,
    occurred_at: patch.occurred_at ?? row.occurred_at,
  };
}

/**
 * Transactions list: one-offs always; recurring only when local calendar date <= today.
 * Future generated instances stay in DB (90d horizon) but are hidden here.
 */
export function filterTransactionsVisible(
  rows: Transaction[],
  timeZone: string,
  now: Date = new Date()
): Transaction[] {
  return rows.filter((t) => {
    if (!t.recurring_series_id) return true;
    return isOnOrBeforeLocalToday(t.occurred_at, timeZone, now);
  });
}

/**
 * Visible rows whose occurred_at falls in the focused calendar month.
 */
export function filterTransactionsForMonth(
  rows: Transaction[],
  timeZone: string,
  focus: PeriodFocus,
  now: Date = new Date()
): Transaction[] {
  const bounds = resolvePeriodBounds('month', timeZone, { focus, now });
  const startMs = bounds.start.getTime();
  const endMs = bounds.end.getTime();
  return filterTransactionsVisible(rows, timeZone, now).filter((t) => {
    const occurred = new Date(t.occurred_at);
    if (Number.isNaN(occurred.getTime())) return false;
    const ms = occurred.getTime();
    return ms >= startMs && ms < endMs;
  });
}

export type UpcomingRepeatsSummary = {
  items: Transaction[];
  count: number;
  expenseSum: number;
  incomeSum: number;
  /** Short label list, e.g. "Rent and Bills, Salary". */
  namesLabel: string;
  /** Date span in local TZ, e.g. "Oct 24 – Oct 31". */
  datesLabel: string;
};

/**
 * Focused-month recurring instances with local date after today (still generated).
 * Defaults to the current calendar month when `focus` is omitted.
 */
export function summarizeUpcomingRepeatsThisMonth(
  rows: Transaction[],
  timeZone: string,
  now: Date = new Date(),
  focus: PeriodFocus = currentPeriodFocus(timeZone, now)
): UpcomingRepeatsSummary | null {
  const bounds = resolvePeriodBounds('month', timeZone, { focus, now });
  const startMs = bounds.start.getTime();
  const endMs = bounds.end.getTime();
  const todayKey = localDateKey(now, timeZone);

  const items = rows
    .filter((t) => {
      if (!t.recurring_series_id) return false;
      const occurred = new Date(t.occurred_at);
      if (Number.isNaN(occurred.getTime())) return false;
      const ms = occurred.getTime();
      if (ms < startMs || ms >= endMs) return false;
      const key = localDateKey(t.occurred_at, timeZone);
      return Boolean(key && todayKey && key > todayKey);
    })
    .sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );

  if (items.length === 0) return null;

  let expenseSum = 0;
  let incomeSum = 0;
  const nameOrder: string[] = [];
  const seen = new Set<string>();
  for (const t of items) {
    if (t.type === 'expense') expenseSum += t.amount;
    else incomeSum += t.amount;
    if (!seen.has(t.category)) {
      seen.add(t.category);
      nameOrder.push(t.category);
    }
  }

  const namesLabel =
    nameOrder.length <= 2
      ? nameOrder.join(', ')
      : `${nameOrder.slice(0, 2).join(', ')} +${nameOrder.length - 2}`;

  const first = items[0].occurred_at;
  const last = items[items.length - 1].occurred_at;
  const firstLabel = formatDisplayDate(first, timeZone);
  const lastLabel = formatDisplayDate(last, timeZone);
  const datesLabel =
    firstLabel === lastLabel ? firstLabel : `${firstLabel} – ${lastLabel}`;

  return {
    items,
    count: items.length,
    expenseSum,
    incomeSum,
    namesLabel,
    datesLabel,
  };
}
