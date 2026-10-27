import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import type { TransactionType } from '@/constants/categories';
import { useAuth } from '@/lib/auth';
import { useConnectivity } from '@/hooks/useConnectivity';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { listLocalTransactions } from '@/lib/offline/transactionsRepo';
import type { PeriodBounds, TrendBucket, TrendSlot } from '@/lib/periods';
import {
  alignCenteredTrendSlots,
  focusFromPeriodBounds,
  resolveTrendBounds,
  trendBucketForPeriod,
} from '@/lib/periods';
import { deviceTimezone } from '@/lib/profile';
import {
  fetchAggregateCategoryTotals,
  fetchAggregateTotals,
  fetchPersonalCategoryTotals,
  fetchPersonalTotals,
  fetchPersonalTrend,
  listCategoryTransactions,
  statsKeys,
  type StatsMetric,
} from '@/lib/stats';
import {
  aggregateCategoryTotals,
  aggregatePeriodTotals,
  aggregateTrend,
  filterCategoryTransactions,
  filterStatsTransactions,
} from '@/lib/statsLocal';

export type StatsScope = 'personal' | 'pair';

/** Empty mirror / no user yet — never leave personal Stats spinning. */
const EMPTY_PERIOD_TOTALS = aggregatePeriodTotals([]);

/**
 * Offline + flag: personal Stats from the SQLite mirror.
 * Until NetInfo's first snapshot, prefer local so a cold offline boot never
 * starts a remote RPC that hangs forever.
 */
function usePersonalStatsLocal(): boolean {
  const { online, ready } = useConnectivity();
  if (!OFFLINE_TXNS_ENABLED) return false;
  if (!ready) return true;
  return !online;
}

export function usePersonalStats(period: PeriodBounds, pieType: TransactionType) {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const timeZone = profile?.timezone || deviceTimezone();
  const useLocal = usePersonalStatsLocal();
  const userId = user?.id;
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();
  const bucket: TrendBucket = trendBucketForPeriod(
    period.start,
    period.end,
    period.preset
  );
  const source = useLocal ? 'local' : 'remote';
  // Local path needs the in-memory auth user — avoid getSession network refresh.
  const localReady = Boolean(userId);
  const enabled = useLocal ? localReady : true;

  const totals = useQuery({
    queryKey: [...statsKeys.totals(startIso, endIso), source, timeZone],
    queryFn: async () => {
      if (!useLocal) {
        return fetchPersonalTotals(period.start, period.end);
      }
      if (!userId) return EMPTY_PERIOD_TOTALS;
      const rows = await listLocalTransactions(userId);
      const scoped = filterStatsTransactions(
        rows,
        period.start,
        period.end,
        timeZone
      );
      return aggregatePeriodTotals(scoped);
    },
    enabled,
  });

  const categories = useQuery({
    queryKey: [...statsKeys.category(pieType, startIso, endIso), source, timeZone],
    queryFn: async () => {
      if (!useLocal) {
        return fetchPersonalCategoryTotals(pieType, period.start, period.end);
      }
      if (!userId) return [];
      const rows = await listLocalTransactions(userId);
      const scoped = filterStatsTransactions(
        rows,
        period.start,
        period.end,
        timeZone
      );
      return aggregateCategoryTotals(scoped, pieType);
    },
    enabled,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: statsKeys.personal() });
    }, [queryClient])
  );

  return { totals, categories, bucket, startIso, endIso, useLocal };
}

/**
 * Pair aggregate stats. Only enable when actively linked.
 * Never fetches partner transaction rows — RPCs return sums/counts only.
 * Always online — callers must disable while offline.
 */
export function useAggregateStats(
  period: PeriodBounds,
  pieType: TransactionType,
  enabled: boolean
) {
  const queryClient = useQueryClient();
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();

  const totals = useQuery({
    queryKey: statsKeys.aggregateTotals(startIso, endIso),
    queryFn: () => fetchAggregateTotals(period.start, period.end),
    enabled,
  });

  const categories = useQuery({
    queryKey: statsKeys.aggregateCategory(pieType, startIso, endIso),
    queryFn: () =>
      fetchAggregateCategoryTotals(pieType, period.start, period.end),
    enabled,
  });

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      void queryClient.invalidateQueries({ queryKey: statsKeys.aggregate() });
    }, [queryClient, enabled])
  );

  return { totals, categories, startIso, endIso };
}

export function usePersonalTrend(
  period: PeriodBounds,
  metric: StatsMetric,
  bucket: TrendBucket,
  timeZone: string = 'UTC'
) {
  const { user } = useAuth();
  const useLocal = usePersonalStatsLocal();
  const userId = user?.id;
  // Centered ±2 window for Monthly/Yearly; custom Period uses the range as-is.
  const { start, end } = resolveTrendBounds(period, timeZone);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const source = useLocal ? 'local' : 'remote';
  const enabled = useLocal ? Boolean(userId) : true;

  return useQuery({
    queryKey: [...statsKeys.trend(metric, startIso, endIso, bucket), source, timeZone],
    queryFn: async () => {
      if (!useLocal) {
        return fetchPersonalTrend(metric, start, end, bucket);
      }
      if (!userId) return [];
      const rows = await listLocalTransactions(userId);
      const scoped = filterStatsTransactions(rows, start, end, timeZone);
      return aggregateTrend(scoped, metric, bucket, timeZone);
    },
    enabled,
    select: (raw): TrendSlot[] => {
      if (period.preset === 'custom') {
        return raw.map((p) => ({
          bucketStart: p.bucketStart,
          total: p.total,
        }));
      }
      const focus = focusFromPeriodBounds(period, timeZone);
      return alignCenteredTrendSlots(focus, period.preset, timeZone, raw);
    },
  });
}

export function useCategoryDrilldown(params: {
  type: TransactionType;
  category: string;
  start: Date;
  end: Date;
  enabled?: boolean;
}) {
  const { profile, user } = useAuth();
  const timeZone = profile?.timezone || deviceTimezone();
  const useLocal = usePersonalStatsLocal();
  const userId = user?.id;
  const startIso = params.start.toISOString();
  const endIso = params.end.toISOString();
  const source = useLocal ? 'local' : 'remote';

  return useQuery({
    queryKey: [
      ...statsKeys.drilldown(
        params.type,
        params.category,
        startIso,
        endIso,
        timeZone
      ),
      source,
    ],
    queryFn: async () => {
      if (!useLocal) {
        return listCategoryTransactions({
          type: params.type,
          category: params.category,
          start: params.start,
          end: params.end,
          timeZone,
        });
      }
      if (!userId) return [];
      const rows = await listLocalTransactions(userId);
      return filterCategoryTransactions(rows, {
        type: params.type,
        category: params.category,
        start: params.start,
        end: params.end,
        timeZone,
      });
    },
    enabled:
      params.enabled !== false &&
      Boolean(params.category) &&
      (useLocal ? Boolean(userId) : true),
  });
}
