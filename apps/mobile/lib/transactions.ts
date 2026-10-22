import type { TransactionCategory, TransactionType } from '@/constants/categories';
import { isValidCategory } from '@/constants/categories';
import {
  currentMonthBounds,
  formatDisplayDate,
  isOnOrBeforeLocalToday,
  localDateKey,
} from '@/lib/dates';

import { supabase } from './supabase';

export type Transaction = {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
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

function mapRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    amount: Number(row.amount),
    type: row.type as TransactionType,
    category: row.category as TransactionCategory,
    note: (row.note as string | null) ?? null,
    currency: String(row.currency ?? 'USD'),
    occurred_at: String(row.occurred_at),
    recurring_series_id: (row.recurring_series_id as string | null) ?? null,
    occurrence_key: (row.occurrence_key as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function validateInput(input: TransactionInput): string | null {
  if (!(input.amount > 0) || Number.isNaN(input.amount)) {
    return 'Amount must be greater than zero.';
  }
  if (input.type !== 'expense' && input.type !== 'income') {
    return 'Type must be expense or income.';
  }
  if (!isValidCategory(input.type, input.category)) {
    return 'Category does not match the selected type.';
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

/** Active (non–soft-deleted) rows for the signed-in user, newest first. */
export async function listTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

/**
 * Ledger list: one-offs always; recurring only when local calendar date <= today.
 * Future generated instances stay in DB (90d horizon) but are hidden here.
 */
export function filterLedgerVisible(
  rows: Transaction[],
  timeZone: string,
  now: Date = new Date()
): Transaction[] {
  return rows.filter((t) => {
    if (!t.recurring_series_id) return true;
    return isOnOrBeforeLocalToday(t.occurred_at, timeZone, now);
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
 * Current-month recurring instances with local date after today (still generated).
 */
export function summarizeUpcomingRepeatsThisMonth(
  rows: Transaction[],
  timeZone: string,
  now: Date = new Date()
): UpcomingRepeatsSummary | null {
  const { start, end } = currentMonthBounds(timeZone, now);
  const startMs = start.getTime();
  const endMs = end.getTime();
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

export async function getTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function createTransaction(
  userId: string,
  input: TransactionInput
): Promise<Transaction> {
  const validationError = validateInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const note = input.note?.trim() ? input.note.trim() : null;

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      amount: input.amount,
      type: input.type,
      category: input.category,
      note,
      currency: 'USD',
      occurred_at: input.occurred_at,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as Record<string, unknown>);
}

export async function updateTransaction(
  id: string,
  input: TransactionInput
): Promise<Transaction> {
  const validationError = validateInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const note = input.note?.trim() ? input.note.trim() : null;

  const { data, error } = await supabase
    .from('transactions')
    .update({
      amount: input.amount,
      type: input.type,
      category: input.category,
      note,
      occurred_at: input.occurred_at,
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as Record<string, unknown>);
}

/** Soft-delete: sets deleted_at; row stays in DB and is hidden from default lists. */
export async function softDeleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export const transactionKeys = {
  all: ['transactions'] as const,
  list: () => [...transactionKeys.all, 'list'] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
};
