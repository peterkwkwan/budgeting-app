import { colors } from '../constants/theme';

/**
 * Period savings rate: (income − expenses) / income.
 * Returns `null` when income is 0 (undefined / n/a — not 0%).
 */
export function savingsRate(
  incomeSum: number,
  expenseSum: number
): number | null {
  if (!(incomeSum > 0)) return null;
  return (incomeSum - expenseSum) / incomeSum;
}

/** Round savings rate to a whole percent, or `null` when undefined. */
export function savingsRatePercent(
  incomeSum: number,
  expenseSum: number
): number | null {
  const rate = savingsRate(incomeSum, expenseSum);
  if (rate == null) return null;
  return Math.round(rate * 100);
}

/**
 * How strongly to tint a displayed savings-rate percent.
 * Cuts sit between the requested examples: 9% stays light, 25% is mid,
 * and 50% or more is the darkest step. The same cuts apply to losses.
 */
export type SavingsRateBand = 'neutral' | 'light' | 'mid' | 'dark';

export function savingsRateBand(percent: number | null): SavingsRateBand {
  if (percent == null || percent === 0) return 'neutral';
  const magnitude = Math.abs(percent);
  if (magnitude >= 50) return 'dark';
  if (magnitude >= 15) return 'mid';
  return 'light';
}

/**
 * Light positive green. `colors.green[400]` is too faint on white for this
 * caption (~2.5:1); this step is about 4.5:1 and still lighter than `green.700`.
 */
const POSITIVE_LIGHT = '#388646';

/**
 * Text color for the savings-rate figure.
 * Positive rates step through green; negative rates step through the expense
 * rust scale (the app's spend color). Break-even and n/a stay muted.
 * Pass the whole percent shown in the UI (`9` means 9%).
 */
export function savingsRateColor(percent: number | null): string {
  const band = savingsRateBand(percent);
  if (band === 'neutral' || percent == null) return colors.inkMuted;
  if (percent > 0) {
    if (band === 'light') return POSITIVE_LIGHT;
    if (band === 'mid') return colors.green[700];
    return colors.green[950];
  }
  if (band === 'light') return colors.rust[500];
  if (band === 'mid') return colors.rust[700];
  return colors.rust[950];
}
