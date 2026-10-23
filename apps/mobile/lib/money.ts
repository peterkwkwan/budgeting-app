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
 * Parse a typed money or rate field.
 * Strips thousands commas, `$`, spaces, and a trailing/leading `USD` before Number.
 * Display still uses {@link formatUsd} commas — this is input-only.
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
