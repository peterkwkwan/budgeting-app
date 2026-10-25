import type { TransactionType } from '@/constants/categories';
import { isOnOrBeforeLocalToday } from '@/lib/dates';
import type { TrendBucket } from '@/lib/periods';
import { listTransactions, type Transaction } from '@/lib/transactions';

import { supabase } from './supabase';

export type StatsMetric = 'expense' | 'income' | 'net';

export type CategoryTotal = {
  category: string;
  type: TransactionType;
  sum: number;
  count: number;
};

export type PeriodTotals = {
  expenseSum: number;
  incomeSum: number;
  expenseCount: number;
  incomeCount: number;
  net: number;
};

export {
  savingsRate,
  savingsRatePercent,
} from './savingsRate';

export type TrendPoint = {
  bucketStart: string;
  total: number;
};

function mapCategoryRow(row: Record<string, unknown>): CategoryTotal {
  return {
    category: String(row.category),
    type: row.type as TransactionType,
    sum: Number(row.sum ?? 0),
    count: Number(row.count ?? 0),
  };
}

export async function fetchPersonalCategoryTotals(
  type: TransactionType,
  start: Date,
  end: Date
): Promise<CategoryTotal[]> {
  const { data, error } = await supabase.rpc('stats_personal_by_category', {
    p_type: type,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    mapCategoryRow(row)
  );
}

export async function fetchPersonalTotals(
  start: Date,
  end: Date
): Promise<PeriodTotals> {
  const { data, error } = await supabase.rpc('stats_personal_totals', {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | undefined;

  const expenseSum = Number(row?.expense_sum ?? 0);
  const incomeSum = Number(row?.income_sum ?? 0);

  return {
    expenseSum,
    incomeSum,
    expenseCount: Number(row?.expense_count ?? 0),
    incomeCount: Number(row?.income_count ?? 0),
    net: incomeSum - expenseSum,
  };
}

/** Trend series; `bucket` must be day|week|month|year (see TREND_RPC_BUCKETS). */
export async function fetchPersonalTrend(
  metric: StatsMetric,
  start: Date,
  end: Date,
  bucket: TrendBucket
): Promise<TrendPoint[]> {
  const { data, error } = await supabase.rpc('stats_personal_trend', {
    p_metric: metric,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_bucket: bucket,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    bucketStart: String(row.bucket_start),
    total: Number(row.total ?? 0),
  }));
}

/** Pair category totals — server aggregates only; never partner txn rows. */
export async function fetchAggregateCategoryTotals(
  type: TransactionType,
  start: Date,
  end: Date
): Promise<CategoryTotal[]> {
  const { data, error } = await supabase.rpc('stats_aggregate_by_category', {
    p_type: type,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    mapCategoryRow(row)
  );
}

/** Pair period totals — aggregates only. */
export async function fetchAggregateTotals(
  start: Date,
  end: Date
): Promise<PeriodTotals> {
  const { data, error } = await supabase.rpc('stats_aggregate_totals', {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | undefined;

  const expenseSum = Number(row?.expense_sum ?? 0);
  const incomeSum = Number(row?.income_sum ?? 0);

  return {
    expenseSum,
    incomeSum,
    expenseCount: Number(row?.expense_count ?? 0),
    incomeCount: Number(row?.income_count ?? 0),
    net: incomeSum - expenseSum,
  };
}

/**
 * Drill-down: own matching transactions only (RLS). Soft-deleted excluded by list.
 * Recurring: only on/before local today. One-offs: include even if future.
 */
export async function listCategoryTransactions(params: {
  type: TransactionType;
  category: string;
  start: Date;
  end: Date;
  timeZone: string;
}): Promise<Transaction[]> {
  const all = await listTransactions();
  const startMs = params.start.getTime();
  const endMs = params.end.getTime();

  return all.filter((t) => {
    if (t.type !== params.type) return false;
    if (t.category !== params.category) return false;
    const occurred = new Date(t.occurred_at).getTime();
    if (Number.isNaN(occurred)) return false;
    if (occurred < startMs || occurred >= endMs) return false;
    if (t.recurring_series_id) {
      return isOnOrBeforeLocalToday(t.occurred_at, params.timeZone);
    }
    return true;
  });
}

export const statsKeys = {
  all: ['stats'] as const,
  personal: () => [...statsKeys.all, 'personal'] as const,
  aggregate: () => [...statsKeys.all, 'aggregate'] as const,
  category: (type: TransactionType, startIso: string, endIso: string) =>
    [...statsKeys.personal(), 'category', type, startIso, endIso] as const,
  totals: (startIso: string, endIso: string) =>
    [...statsKeys.personal(), 'totals', startIso, endIso] as const,
  trend: (
    metric: StatsMetric,
    startIso: string,
    endIso: string,
    bucket: TrendBucket
  ) => [...statsKeys.personal(), 'trend', metric, startIso, endIso, bucket] as const,
  aggregateCategory: (
    type: TransactionType,
    startIso: string,
    endIso: string
  ) =>
    [...statsKeys.aggregate(), 'category', type, startIso, endIso] as const,
  aggregateTotals: (startIso: string, endIso: string) =>
    [...statsKeys.aggregate(), 'totals', startIso, endIso] as const,
  drilldown: (
    type: TransactionType,
    category: string,
    startIso: string,
    endIso: string,
    timeZone?: string
  ) =>
    [
      ...statsKeys.personal(),
      'drilldown',
      type,
      category,
      startIso,
      endIso,
      timeZone ?? '',
    ] as const,
};
