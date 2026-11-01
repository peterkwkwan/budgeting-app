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
 * Text color for the savings-rate figure.
 * Positive rates use the income green; negative rates use the expense rust.
 * Break-even and n/a stay muted. Magnitude does not change the tint.
 * Pass the whole percent shown in the UI (`9` means 9%).
 */
export function savingsRateColor(percent: number | null): string {
  if (percent == null || percent === 0) return colors.inkMuted;
  if (percent > 0) return colors.income;
  return colors.expense;
}
