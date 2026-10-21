import { colors } from '@/constants/theme';

/** Categorical series for pie slices — design-system chart palette. */
export const CHART_CATEGORY_COLORS = [
  colors.green[950],
  colors.green[700],
  colors.green[400],
  colors.green[200],
  colors.chartWarm,
  '#0f766e',
  '#365314',
  '#a16207',
  '#9a3412',
  '#1e3a2f',
  '#4d7c6f',
  '#7c2d12',
] as const;

export function colorForCategory(index: number): string {
  return CHART_CATEGORY_COLORS[index % CHART_CATEGORY_COLORS.length]!;
}
