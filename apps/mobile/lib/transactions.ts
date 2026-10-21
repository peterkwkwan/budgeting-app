import type { TransactionCategory, TransactionType } from '@/constants/categories';
import { isValidCategory } from '@/constants/categories';

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
