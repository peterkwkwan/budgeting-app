import type { TransactionType } from '@/constants/categories';
import { colors } from '@/constants/theme';

/** Income / growth categorical series (cool greens). */
export const CHART_INCOME_COLORS = [
  colors.green[950],
  colors.green[700],
  colors.green[400],
  colors.green[200],
] as const;

/** Expense / spend categorical series (warm rust). */
export const CHART_EXPENSE_COLORS = [
  colors.rust[950],
  colors.rust[700],
  colors.rust[500],
  colors.rust[400],
  colors.rust[200],
] as const;

/** @deprecated Prefer colorForCategory(index, type). */
export const CHART_CATEGORY_COLORS = CHART_INCOME_COLORS;

export function chartColorsForType(
  type: TransactionType
): readonly string[] {
  return type === 'income' ? CHART_INCOME_COLORS : CHART_EXPENSE_COLORS;
}

export function colorForCategory(
  index: number,
  type: TransactionType = 'expense'
): string {
  const palette = chartColorsForType(type);
  return palette[index % palette.length]!;
}

/** Single-series stroke for trend line by metric. */
export function trendStrokeForMetric(
  metric: 'expense' | 'income' | 'net'
): string {
  if (metric === 'income') return colors.income;
  if (metric === 'expense') return colors.expense;
  // Net: cool brand accent; sign still shown in totals via income/expense tokens.
  return colors.green[700];
}
