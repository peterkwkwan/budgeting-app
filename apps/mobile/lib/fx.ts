/**
 * Suggest today's FX rate for currency change (1 from = rate to).
 * Source: open.er-api.com (free HTTPS, includes HKD). No API key.
 */

import type { AccountCurrency } from '@/constants/currencies';

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // a few hours
const FETCH_TIMEOUT_MS = 8000;

type CacheEntry = {
  base: AccountCurrency;
  rates: Record<string, number>;
  fetchedAt: number;
};

let memoryCache: CacheEntry | null = null;

export type FxSuggestResult =
  | { ok: true; rate: number; source: 'api' | 'cache' }
  | { ok: false; message: string };

async function fetchLatestRates(
  base: AccountCurrency
): Promise<Record<string, number>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
      { signal: controller.signal }
    );
    if (!res.ok) {
      throw new Error(`FX lookup failed (${res.status})`);
    }
    const json = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (json.result !== 'success' || !json.rates) {
      throw new Error('FX lookup returned no rates');
    }
    return json.rates;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rate such that `1 fromCurrency = rate toCurrency`.
 * Cached a few hours client-side. On failure, caller shows empty field + Keep.
 */
export async function suggestFxRate(
  from: AccountCurrency,
  to: AccountCurrency
): Promise<FxSuggestResult> {
  if (from === to) {
    return { ok: true, rate: 1, source: 'cache' };
  }

  const now = Date.now();
  if (
    memoryCache &&
    memoryCache.base === from &&
    now - memoryCache.fetchedAt < CACHE_TTL_MS &&
    typeof memoryCache.rates[to] === 'number'
  ) {
    return { ok: true, rate: memoryCache.rates[to]!, source: 'cache' };
  }

  try {
    const rates = await fetchLatestRates(from);
    memoryCache = { base: from, rates, fetchedAt: Date.now() };
    const rate = rates[to];
    if (!(typeof rate === 'number') || !(rate > 0)) {
      return {
        ok: false,
        message: 'Couldn’t find a rate for that pair. Type one, or keep amounts as-is.',
      };
    }
    return { ok: true, rate, source: 'api' };
  } catch {
    return {
      ok: false,
      message:
        'Couldn’t load today’s rate. Type one, or keep amounts as-is.',
    };
  }
}

/** Format a suggested rate for the editable field (trim noisy decimals). */
export function formatFxRateInput(rate: number): string {
  if (!(rate > 0) || !Number.isFinite(rate)) return '';
  if (rate >= 100) return rate.toFixed(4).replace(/\.?0+$/, '');
  if (rate >= 1) return rate.toFixed(6).replace(/\.?0+$/, '');
  return rate.toFixed(8).replace(/\.?0+$/, '');
}

/** Test helper — clear in-memory FX cache. */
export function __resetFxCacheForTests() {
  memoryCache = null;
}
