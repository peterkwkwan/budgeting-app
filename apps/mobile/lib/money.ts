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
