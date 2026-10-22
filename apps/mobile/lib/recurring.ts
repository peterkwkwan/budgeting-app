import type { TransactionCategory, TransactionType } from '@/constants/categories';
import { isValidCategory } from '@/constants/categories';

import { supabase } from './supabase';

export type RecurringCadence = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const RECURRING_CADENCES: readonly RecurringCadence[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;

export type RecurringSeries = {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  note: string | null;
  cadence: RecurringCadence;
  /** 0=Sun … 6=Sat; null = no weekday filter. */
  byweekday: number[] | null;
  anchor_at: string;
  timezone: string;
  active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringSeriesInput = {
  amount: number;
  type: TransactionType;
  category: string;
  note?: string | null;
  cadence: RecurringCadence;
  byweekday?: number[] | null;
  anchor_at: string;
  timezone: string;
};

export type RecurringSeriesUpdateInput = {
  amount: number;
  type: TransactionType;
  category: string;
  note?: string | null;
};

function mapByweekday(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const days = raw
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length > 0 ? days : null;
}

function mapRow(row: Record<string, unknown>): RecurringSeries {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    amount: Number(row.amount),
    type: row.type as TransactionType,
    category: row.category as TransactionCategory,
    note: (row.note as string | null) ?? null,
    cadence: row.cadence as RecurringCadence,
    byweekday: mapByweekday(row.byweekday),
    anchor_at: String(row.anchor_at),
    timezone: String(row.timezone ?? 'UTC'),
    active: Boolean(row.active),
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function validateCreate(input: RecurringSeriesInput): string | null {
  if (!(input.amount > 0) || Number.isNaN(input.amount)) {
    return 'Amount must be greater than zero.';
  }
  if (input.type !== 'expense' && input.type !== 'income') {
    return 'Type must be expense or income.';
  }
  if (!isValidCategory(input.type, input.category)) {
    return 'Category does not match the selected type.';
  }
  if (!RECURRING_CADENCES.includes(input.cadence)) {
    return 'Pick daily, weekly, monthly, or yearly.';
  }
  if (input.byweekday != null) {
    if (
      !Array.isArray(input.byweekday) ||
      input.byweekday.length === 0 ||
      input.byweekday.some(
        (d) => !Number.isInteger(d) || d < 0 || d > 6
      )
    ) {
      return 'Weekday filter must be days 0–6.';
    }
  }
  const note = input.note?.trim() ?? '';
  if (note.length > 500) {
    return 'Note must be 500 characters or fewer.';
  }
  if (!input.anchor_at) {
    return 'Start date is required.';
  }
  if (!input.timezone) {
    return 'Timezone is required.';
  }
  return null;
}

function validateUpdate(input: RecurringSeriesUpdateInput): string | null {
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
  return null;
}

export function cadenceLabel(cadence: RecurringCadence): string {
  switch (cadence) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
  }
}

/** Active rules only (stopped series are hard-deleted and never listed). */
export async function listRecurringSeries(): Promise<RecurringSeries[]> {
  const { data, error } = await supabase
    .from('recurring_series')
    .select('*')
    .eq('active', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function getRecurringSeries(
  id: string
): Promise<RecurringSeries | null> {
  const { data, error } = await supabase
    .from('recurring_series')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function createRecurringSeries(
  userId: string,
  input: RecurringSeriesInput
): Promise<RecurringSeries> {
  const validationError = validateCreate(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const note = input.note?.trim() ? input.note.trim() : null;

  const byweekday =
    input.byweekday && input.byweekday.length > 0 ? input.byweekday : null;

  const { data, error } = await supabase
    .from('recurring_series')
    .insert({
      user_id: userId,
      amount: input.amount,
      type: input.type,
      category: input.category,
      note,
      cadence: input.cadence,
      byweekday,
      anchor_at: input.anchor_at,
      timezone: input.timezone,
      active: true,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as Record<string, unknown>);
}

/** Updates series + future ledger instances only (RPC). Past instances unchanged. */
export async function updateRecurringSeriesFuture(
  id: string,
  input: RecurringSeriesUpdateInput
): Promise<void> {
  const validationError = validateUpdate(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const note = input.note?.trim() ? input.note.trim() : null;

  const { error } = await supabase.rpc('update_recurring_series_future', {
    p_series_id: id,
    p_amount: input.amount,
    p_type: input.type,
    p_category: input.category,
    p_note: note,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Stop series: hard-delete the rule + future instances (after local today).
 * Past/today ledger rows remain. Rule disappears from manage lists.
 */
export async function stopRecurringSeries(id: string): Promise<void> {
  const { error } = await supabase.rpc('stop_recurring_series', {
    p_series_id: id,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Ask the server to fill missing instances for this user (rolling 90d).
 * Safe to call on app open; idempotent.
 */
export async function catchUpRecurring(): Promise<{
  ok: boolean;
  inserted?: number;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('catch-up-recurring', {
    method: 'POST',
    body: {},
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const inserted =
    data && typeof data === 'object' && 'inserted' in data
      ? Number((data as { inserted: unknown }).inserted)
      : undefined;

  return { ok: true, inserted };
}

export const recurringKeys = {
  all: ['recurring'] as const,
  list: () => [...recurringKeys.all, 'list'] as const,
  detail: (id: string) => [...recurringKeys.all, 'detail', id] as const,
};
