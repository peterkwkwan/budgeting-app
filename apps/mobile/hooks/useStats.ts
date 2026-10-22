import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import type { TransactionType } from '@/constants/categories';
import type { PeriodBounds, TrendBucket } from '@/lib/periods';
import { trendBucketForPeriod } from '@/lib/periods';
import {
  fetchPersonalCategoryTotals,
  fetchPersonalTotals,
  fetchPersonalTrend,
  listCategoryTransactions,
  statsKeys,
  type StatsMetric,
} from '@/lib/stats';

export function usePersonalStats(period: PeriodBounds, pieType: TransactionType) {
  const queryClient = useQueryClient();
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();
  const bucket: TrendBucket = trendBucketForPeriod(period.start, period.end);

  const totals = useQuery({
    queryKey: statsKeys.totals(startIso, endIso),
    queryFn: () => fetchPersonalTotals(period.start, period.end),
  });

  const categories = useQuery({
    queryKey: statsKeys.category(pieType, startIso, endIso),
    queryFn: () => fetchPersonalCategoryTotals(pieType, period.start, period.end),
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: statsKeys.personal() });
    }, [queryClient])
  );

  return { totals, categories, bucket, startIso, endIso };
}

export function usePersonalTrend(
  period: PeriodBounds,
  metric: StatsMetric,
  bucket: TrendBucket
) {
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();

  return useQuery({
    queryKey: statsKeys.trend(metric, startIso, endIso, bucket),
    queryFn: () =>
      fetchPersonalTrend(metric, period.start, period.end, bucket),
  });
}

export function useCategoryDrilldown(params: {
  type: TransactionType;
  category: string;
  start: Date;
  end: Date;
  enabled?: boolean;
}) {
  const startIso = params.start.toISOString();
  const endIso = params.end.toISOString();

  return useQuery({
    queryKey: statsKeys.drilldown(
      params.type,
      params.category,
      startIso,
      endIso
    ),
    queryFn: () =>
      listCategoryTransactions({
        type: params.type,
        category: params.category,
        start: params.start,
        end: params.end,
      }),
    enabled: params.enabled !== false && Boolean(params.category),
  });
}
