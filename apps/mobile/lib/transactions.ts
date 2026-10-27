/**
 * Remote Supabase adapter for transactions.
 * Pure shapes, validation, and list filters live in `transactionModel.ts`
 * and are re-exported here so existing imports stay put.
 * Offline writes go through `lib/offline/transactionsRepo` (flagged off).
 */
import { DEFAULT_CURRENCY } from '@/constants/currencies';
import {
  inputFromBulkPatch,
  validateTransactionInput,
  type Transaction,
  type TransactionBulkPatch,
  type TransactionInput,
} from '@/lib/transactionModel';

import { supabase } from './supabase';

export {
  filterTransactionsForMonth,
  filterTransactionsVisible,
  inputFromBulkPatch,
  summarizeUpcomingRepeatsThisMonth,
  validateTransactionInput,
} from '@/lib/transactionModel';
export type {
  Transaction,
  TransactionBulkPatch,
  TransactionInput,
  UpcomingRepeatsSummary,
} from '@/lib/transactionModel';

function mapRow(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    amount: Number(row.amount),
    type: row.type as Transaction['type'],
    category: String(row.category),
    note: (row.note as string | null) ?? null,
    currency: String(row.currency ?? DEFAULT_CURRENCY),
    occurred_at: String(row.occurred_at),
    recurring_series_id: (row.recurring_series_id as string | null) ?? null,
    occurrence_key: (row.occurrence_key as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
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
  input: TransactionInput,
  currency: string = DEFAULT_CURRENCY
): Promise<Transaction> {
  const validationError = validateTransactionInput(input);
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
      category: input.category.trim(),
      note,
      currency,
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
  const validationError = validateTransactionInput(input);
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

/** Soft-delete many rows with the same policy as single-delete. */
export async function softDeleteTransactions(ids: string[]): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  await Promise.all(unique.map((id) => softDeleteTransaction(id)));
}

/**
 * Apply one shared field value to each row. Keeps amount/type/(other fields)
 * from the provided snapshots so validation still matches single-edit rules.
 */
export async function bulkPatchTransactions(
  rows: Transaction[],
  patch: TransactionBulkPatch
): Promise<void> {
  if (rows.length === 0) return;
  if (
    patch.occurred_at === undefined &&
    patch.category === undefined &&
    patch.note === undefined
  ) {
    return;
  }

  await Promise.all(
    rows.map((row) => updateTransaction(row.id, inputFromBulkPatch(row, patch)))
  );
}

export const transactionKeys = {
  all: ['transactions'] as const,
  list: () => [...transactionKeys.all, 'list'] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
};
