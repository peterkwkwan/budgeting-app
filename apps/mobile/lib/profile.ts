import * as Localization from 'expo-localization';
import type { User } from '@supabase/supabase-js';

import {
  DEFAULT_CURRENCY,
  parseAccountCurrency,
  type AccountCurrency,
} from '@/constants/currencies';

import { supabase } from './supabase';

/** Transactions screen date layout preference (profiles.transactions_date_view). */
export type TransactionsDateView = 'list' | 'week' | 'month';

export const DEFAULT_TRANSACTIONS_DATE_VIEW: TransactionsDateView = 'month';

export function parseTransactionsDateView(
  value: unknown
): TransactionsDateView {
  if (value === 'list' || value === 'week' || value === 'month') {
    return value;
  }
  return DEFAULT_TRANSACTIONS_DATE_VIEW;
}

export type Profile = {
  id: string;
  display_name: string | null;
  timezone: string;
  /** Last chosen Transactions date layout; default month. */
  transactions_date_view: TransactionsDateView;
  /** One currency per account; default HKD. */
  currency: AccountCurrency;
  currency_converted_at: string | null;
  last_fx_from: string | null;
  last_fx_to: string | null;
  last_fx_rate: number | null;
  created_at: string;
  updated_at: string;
};

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    display_name: (row.display_name as string | null) ?? null,
    timezone: String(row.timezone ?? 'UTC'),
    transactions_date_view: parseTransactionsDateView(
      row.transactions_date_view
    ),
    currency: parseAccountCurrency(row.currency ?? DEFAULT_CURRENCY),
    currency_converted_at:
      (row.currency_converted_at as string | null) ?? null,
    last_fx_from: (row.last_fx_from as string | null) ?? null,
    last_fx_to: (row.last_fx_to as string | null) ?? null,
    last_fx_rate:
      row.last_fx_rate == null || row.last_fx_rate === ''
        ? null
        : Number(row.last_fx_rate),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function deviceTimezone(): string {
  const calendars = Localization.getCalendars();
  return calendars[0]?.timeZone ?? 'UTC';
}

/**
 * Ensures a profiles row exists and records the device IANA timezone on first login.
 * Uses upsert so it is safe if the auth.users trigger already inserted a row.
 */
export async function ensureProfile(user: User): Promise<Profile | null> {
  const displayName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    user.email ||
    null;

  const timezone = deviceTimezone();

  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (selectError) {
    console.warn('[profile] select failed', selectError.message);
  }

  if (existing) {
    const mapped = mapProfile(existing as Record<string, unknown>);
    // Keep an existing timezone; only backfill if still the default and device knows better.
    if (mapped.timezone === 'UTC' && timezone !== 'UTC') {
      const { data, error } = await supabase
        .from('profiles')
        .update({ timezone, display_name: mapped.display_name ?? displayName })
        .eq('id', user.id)
        .select('*')
        .single();
      if (error) {
        console.warn('[profile] timezone backfill failed', error.message);
        return mapped;
      }
      return mapProfile(data as Record<string, unknown>);
    }
    return mapped;
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        display_name: displayName,
        timezone,
        transactions_date_view: DEFAULT_TRANSACTIONS_DATE_VIEW,
        currency: DEFAULT_CURRENCY,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();

  if (error) {
    console.warn('[profile] upsert failed', error.message);
    return null;
  }

  return mapProfile(data as Record<string, unknown>);
}

/** Persist Transactions date layout preference for the signed-in user. */
export async function updateTransactionsDateView(
  userId: string,
  view: TransactionsDateView
): Promise<TransactionsDateView> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ transactions_date_view: view })
    .eq('id', userId)
    .select('transactions_date_view')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return parseTransactionsDateView(data?.transactions_date_view);
}
