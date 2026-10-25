import {
  DEFAULT_CURRENCY,
  parseAccountCurrency,
  type AccountCurrency,
} from '@/constants/currencies';

import { supabase } from './supabase';

export type SetCurrencyMode = 'keep' | 'convert';

export type SetCurrencyResult = {
  currency: AccountCurrency;
  currency_converted_at: string | null;
  last_fx_from: string | null;
  last_fx_to: string | null;
  last_fx_rate: number | null;
};

/**
 * Change account currency. `keep` only relabels; `convert` multiplies all
 * money fields by `rate` where 1 old = rate new.
 */
export async function setAccountCurrency(input: {
  newCurrency: AccountCurrency;
  mode: SetCurrencyMode;
  rate?: number | null;
}): Promise<SetCurrencyResult> {
  const { data, error } = await supabase.rpc('set_account_currency', {
    p_new_currency: input.newCurrency,
    p_mode: input.mode,
    p_rate: input.mode === 'convert' ? input.rate : null,
  });

  if (error) throw new Error(error.message);

  const row = data as Record<string, unknown>;
  return {
    currency: parseAccountCurrency(row.currency),
    currency_converted_at:
      (row.currency_converted_at as string | null) ?? null,
    last_fx_from: (row.last_fx_from as string | null) ?? null,
    last_fx_to: (row.last_fx_to as string | null) ?? null,
    last_fx_rate:
      row.last_fx_rate == null ? null : Number(row.last_fx_rate),
  };
}

export function profileCurrency(
  profile: { currency?: string | null } | null | undefined
): AccountCurrency {
  return parseAccountCurrency(profile?.currency ?? DEFAULT_CURRENCY);
}
