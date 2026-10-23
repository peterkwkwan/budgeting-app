/**
 * USD display with a `$` prefix, two decimals, and thousands commas.
 * The sign is left to the caller so expenses and income keep the existing
 * unicode minus (`−`) and plus prefixes instead of an ASCII hyphen.
 *
 * `12.5` → `$12.50`, `1200` → `$1,200.00`, `10000` → `$10,000.00`.
 */
export function formatUsd(amount: number): string {
  const [whole, frac = '00'] = Math.abs(amount).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${grouped}.${frac}`;
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
    .replace(/usd/gi, '')
    .replace(/[$,\s]/g, '');
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
