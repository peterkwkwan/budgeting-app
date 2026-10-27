import {
  currencyFractionDigits,
  currencySymbol,
  parseAccountCurrency,
  type AccountCurrency,
} from '@/constants/currencies';

/**
 * Account-currency display with symbol, fraction digits, and thousands commas.
 * The sign is left to the caller so expenses and income keep the existing
 * unicode minus (`−`) and plus prefixes instead of an ASCII hyphen.
 *
 * HKD `12.5` → `HK$12.50`, JPY `1200` → `¥1,200`.
 * Pass `{ whole: true }` to round to whole units (Stats By category).
 */
export function formatMoney(
  amount: number,
  currency: AccountCurrency | string = 'HKD',
  options?: { whole?: boolean }
): string {
  const code = parseAccountCurrency(currency);
  const digits = options?.whole ? 0 : currencyFractionDigits(code);
  const symbol = currencySymbol(code);
  const abs = Math.abs(amount);
  if (digits === 0) {
    const whole = Math.round(abs).toString();
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${symbol}${grouped}`;
  }
  const [whole, frac = '00'] = abs.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${grouped}.${frac}`;
}

/**
 * Compact axis / chip labels — never full `HK$1,079,462.49`.
 * Under 1000 → `HK$n`; thousands → `HK$nk`; millions → `HK$n.nM`.
 * Includes a leading `-` for negatives (unlike formatMoney).
 */
export function formatCompactMoney(
  amount: number,
  currency: AccountCurrency | string = 'HKD'
): string {
  const code = parseAccountCurrency(currency);
  const symbol = currencySymbol(code);
  if (!Number.isFinite(amount)) return `${symbol}0`;
  const sign = amount < 0 ? '-' : '';
  const a = Math.abs(amount);

  if (a < 1000) {
    return `${sign}${symbol}${Math.round(a)}`;
  }

  if (a < 1_000_000) {
    const k = a / 1000;
    const rounded1 = Math.round(k * 10) / 10;
    if (Math.abs(rounded1 - Math.round(rounded1)) < 1e-9) {
      return `${sign}${symbol}${Math.round(rounded1)}k`;
    }
    return `${sign}${symbol}${rounded1.toFixed(1)}k`;
  }

  const m = a / 1_000_000;
  const rounded1 = Math.round(m * 10) / 10;
  return `${sign}${symbol}${rounded1.toFixed(1)}M`;
}

/** @deprecated Prefer formatMoney(amount, currency). Kept for USD-focused tests. */
export function formatUsd(amount: number): string {
  return formatMoney(amount, 'USD');
}

/** @deprecated Prefer formatCompactMoney(amount, currency). */
export function formatCompactUsd(amount: number): string {
  return formatCompactMoney(amount, 'USD');
}

/**
 * 3–4 nice tick values spanning [min, max] for a chart Y-axis.
 */
export function niceAxisTicks(
  min: number,
  max: number,
  targetCount = 4
): number[] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0];
  if (!(hi > lo)) {
    const pad = Math.max(Math.abs(hi) * 0.1, 1);
    return niceAxisTicks(lo - pad, hi + pad, targetCount);
  }

  const count = Math.min(4, Math.max(3, Math.round(targetCount)));
  const rough = (hi - lo) / (count - 1);
  const step = niceNumber(rough);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  for (let v = start; v <= end + step * 1e-9; v += step) {
    ticks.push(roundTick(v));
  }

  // Prefer 3–4 ticks: thin if the nice step produced too many
  if (ticks.length > 4) {
    const thinned: number[] = [];
    const stride = Math.ceil((ticks.length - 1) / 3);
    for (let i = 0; i < ticks.length; i += stride) {
      thinned.push(ticks[i]!);
    }
    const last = ticks[ticks.length - 1]!;
    if (thinned[thinned.length - 1] !== last) thinned.push(last);
    return thinned.slice(0, 4);
  }
  if (ticks.length < 3) {
    return [roundTick(lo), roundTick((lo + hi) / 2), roundTick(hi)];
  }
  return ticks;
}

/** Domain that exactly covers the tick set (so grid lines sit on ticks). */
export function tickDomain(
  ticks: number[],
  fallbackMin: number,
  fallbackMax: number
): { min: number; max: number } {
  if (ticks.length === 0) {
    return { min: fallbackMin, max: fallbackMax };
  }
  return {
    min: Math.min(...ticks),
    max: Math.max(...ticks),
  };
}

function niceNumber(rough: number): number {
  const abs = Math.abs(rough) || 1;
  const exp = Math.floor(Math.log10(abs));
  const mag = Math.pow(10, exp);
  const norm = abs / mag;
  let niceNorm: number;
  if (norm <= 1) niceNorm = 1;
  else if (norm <= 2) niceNorm = 2;
  else if (norm <= 2.5) niceNorm = 2.5;
  else if (norm <= 5) niceNorm = 5;
  else niceNorm = 10;
  return niceNorm * mag;
}

function roundTick(v: number): number {
  if (Math.abs(v) < 1e-9) return 0;
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const decimals = Math.max(0, -exp + 2);
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

/**
 * Parse a typed money field (or rate when reused carefully).
 * Strips thousands commas, `$`, spaces, and `USD` before Number.
 *
 * `557,269` → `557269`, `$1,200.50` → `1200.5`, blank → `NaN`.
 */
export function parseMoneyInput(raw: string): number {
  const cleaned = raw
    .trim()
    .replace(
      /\b(hkd|usd|cny|eur|gbp|jpy|cad|aud|sgd|chf|inr|krw|twd|thb|myr|php|idr|nzd|sek|nok)\b/gi,
      ''
    )
    .replace(/HK\$|NT\$|CA\$|A\$|NZ\$|S\$|RM|Rp/gi, '')
    .replace(/[$,€£¥₩₹฿₱kr\s]/gi, '');
  if (
    cleaned === '' ||
    cleaned === '-' ||
    cleaned === '+' ||
    cleaned === '.' ||
    cleaned === '-.' ||
    cleaned === '+.'
  ) {
    return Number.NaN;
  }
  return Number(cleaned);
}

/** Alias — prefer this name at call sites for dollar amount fields. */
export const parseAmountInput = parseMoneyInput;

/**
 * Live TextInput formatting for USD amounts: US thousands commas, optional
 * decimals (max 2). Cursor typically ends up at the end (simple reformat).
 *
 * Do **not** use on percentages, year counts, or other non-money fields.
 *
 * `500000` → `500,000`, `1234.5` → `1,234.5`, `1,234.` stays with trailing dot.
 */
export function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (cleaned === '') return '';

  const dot = cleaned.indexOf('.');
  let intRaw: string;
  let fracRaw: string | null = null;
  let trailingDot = false;

  if (dot === -1) {
    intRaw = cleaned;
  } else {
    intRaw = cleaned.slice(0, dot);
    fracRaw = cleaned
      .slice(dot + 1)
      .replace(/\./g, '')
      .slice(0, 2);
    trailingDot = fracRaw === '' && cleaned.endsWith('.');
  }

  // ".5" → treat as 0.5
  if (intRaw === '' && (fracRaw != null || trailingDot)) {
    intRaw = '0';
  }

  // Drop leading zeros but keep a lone 0
  intRaw = intRaw.replace(/^0+(?=\d)/, '');

  const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (trailingDot) return `${grouped}.`;
  if (fracRaw != null) return `${grouped}.${fracRaw}`;
  return grouped;
}

/** Seed an amount TextInput from a numeric value (edit screens). */
export function formatAmountInputFromNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return formatAmountInput(String(n));
  // Keep up to 2 decimal places without forcing trailing zeros
  const fixed = (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return formatAmountInput(fixed);
}
