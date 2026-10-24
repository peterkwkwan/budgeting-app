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
