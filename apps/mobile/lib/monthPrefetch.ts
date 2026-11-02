/**
 * Warm React Query caches for months adjacent to the focused card.
 * Prev/current/next full month UIs read the same keys — no flash of wrong-month data.
 */

import type { QueryClient } from '@tanstack/react-query';

import type { TransactionType } from '@/constants/categories';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { listLocalTransactions } from '@/lib/offline/transactionsRepo';
import {
  adjacentMonthFocuses,
  nearbyMonthFocuses,
} from '@/lib/monthSwipe';
import {
  resolvePeriodBounds,
  resolveTrendBounds,
  trendBucketForPeriod,
  type PeriodFocus,
} from '@/lib/periods';
import {
  aggregateCategoryTotals,
  aggregatePeriodTotals,
  aggregateTrend,
  filterStatsTransactions,
} from '@/lib/statsLocal';
import {
  fetchAggregateCategoryTotals,
  fetchAggregateTotals,
  fetchPersonalCategoryTotals,
  fetchPersonalTotals,
  fetchPersonalTrend,
  statsKeys,
  type StatsMetric,
} from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import {
  listTransactions,
  transactionKeys,
} from '@/lib/transactions';

const EMPTY_PERIOD_TOTALS = aggregatePeriodTotals([]);

export type PrefetchStatsMonthsArgs = {
  focus: PeriodFocus;
  timeZone: string;
  pieType: TransactionType;
  /** Offline SQLite personal path (matches usePersonalStats). */
  useLocal: boolean;
  userId?: string;
  /** Prefetch partner aggregate RPCs when Pair scope is live. */
  pairLive?: boolean;
  /** Also warm personal trend for the settled adjacent months. */
  trendMetric?: StatsMetric;
};

async function localRows(userId: string | undefined) {
  if (!userId) return [];
  return listLocalTransactions(userId);
}

async function signedInUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You must be signed in.');
  return userId;
}

/** Ensure the shared transactions list is in cache (client filters by month). */
export function prefetchTransactionList(
  queryClient: QueryClient
): Promise<unknown> {
  return queryClient.prefetchQuery({
    queryKey: transactionKeys.list(),
    queryFn: OFFLINE_TXNS_ENABLED
      ? () => signedInUserId().then((userId) => listLocalTransactions(userId))
      : listTransactions,
  });
}

/** Prefetch personal (and optional pair) stats for one calendar month. */
export function prefetchStatsMonth(
  queryClient: QueryClient,
  args: Omit<PrefetchStatsMonthsArgs, 'focus'> & { focus: PeriodFocus }
): void {
  const {
    focus,
    timeZone,
    pieType,
    useLocal,
    userId,
    pairLive = false,
    trendMetric,
  } = args;
  const period = resolvePeriodBounds('month', timeZone, { focus });
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();
  const source = useLocal ? 'local' : 'remote';

  void queryClient.prefetchQuery({
    queryKey: [...statsKeys.totals(startIso, endIso), source, timeZone],
    queryFn: async () => {
      if (!useLocal) {
        return fetchPersonalTotals(period.start, period.end);
      }
      if (!userId) return EMPTY_PERIOD_TOTALS;
      const rows = await localRows(userId);
      return aggregatePeriodTotals(
        filterStatsTransactions(rows, period.start, period.end, timeZone)
      );
    },
  });

  void queryClient.prefetchQuery({
    queryKey: [
      ...statsKeys.category(pieType, startIso, endIso),
      source,
      timeZone,
    ],
    queryFn: async () => {
      if (!useLocal) {
        return fetchPersonalCategoryTotals(pieType, period.start, period.end);
      }
      if (!userId) return [];
      const rows = await localRows(userId);
      const scoped = filterStatsTransactions(
        rows,
        period.start,
        period.end,
        timeZone
      );
      return aggregateCategoryTotals(scoped, pieType);
    },
  });

  if (trendMetric) {
    const bucket = trendBucketForPeriod(
      period.start,
      period.end,
      period.preset
    );
    const trendBounds = resolveTrendBounds(period, timeZone);
    const trendStartIso = trendBounds.start.toISOString();
    const trendEndIso = trendBounds.end.toISOString();
    void queryClient.prefetchQuery({
      queryKey: [
        ...statsKeys.trend(
          trendMetric,
          trendStartIso,
          trendEndIso,
          bucket
        ),
        source,
        timeZone,
      ],
      queryFn: async () => {
        if (!useLocal) {
          return fetchPersonalTrend(
            trendMetric,
            trendBounds.start,
            trendBounds.end,
            bucket
          );
        }
        if (!userId) return [];
        const rows = await localRows(userId);
        const scoped = filterStatsTransactions(
          rows,
          trendBounds.start,
          trendBounds.end,
          timeZone
        );
        return aggregateTrend(scoped, trendMetric, bucket, timeZone);
      },
    });
  }

  if (pairLive && !useLocal) {
    void queryClient.prefetchQuery({
      queryKey: statsKeys.aggregateTotals(startIso, endIso),
      queryFn: () => fetchAggregateTotals(period.start, period.end),
    });
    void queryClient.prefetchQuery({
      queryKey: statsKeys.aggregateCategory(pieType, startIso, endIso),
      queryFn: () =>
        fetchAggregateCategoryTotals(pieType, period.start, period.end),
    });
  }
}

/**
 * Whether one calendar month’s Stats totals are already in cache
 * (Quiet empty months count as ready — totals present with zero txns).
 */
export function isStatsMonthCached(
  queryClient: QueryClient,
  args: Omit<PrefetchStatsMonthsArgs, 'trendMetric'> & { focus: PeriodFocus }
): boolean {
  const {
    focus,
    timeZone,
    useLocal,
    pairLive = false,
  } = args;
  const period = resolvePeriodBounds('month', timeZone, { focus });
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();
  const source = useLocal ? 'local' : 'remote';

  if (pairLive && !useLocal) {
    return (
      queryClient.getQueryData(statsKeys.aggregateTotals(startIso, endIso)) !=
      null
    );
  }

  return (
    queryClient.getQueryData([
      ...statsKeys.totals(startIso, endIso),
      source,
      timeZone,
    ]) != null
  );
}

/** True when both visible neighbors (M±1) have cached Stats totals. */
export function areAdjacentStatsMonthsCached(
  queryClient: QueryClient,
  args: Omit<PrefetchStatsMonthsArgs, 'trendMetric' | 'pieType'> & {
    pieType?: PrefetchStatsMonthsArgs['pieType'];
  }
): boolean {
  const { prev, next } = adjacentMonthFocuses(args.focus);
  const checkArgs = {
    timeZone: args.timeZone,
    pieType: args.pieType ?? ('expense' as const),
    useLocal: args.useLocal,
    userId: args.userId,
    pairLive: args.pairLive,
  };
  return (
    isStatsMonthCached(queryClient, { ...checkArgs, focus: prev }) &&
    isStatsMonthCached(queryClient, { ...checkArgs, focus: next })
  );
}

/** Prefetch M±1 and M±2 for the focused month card (rapid-swipe warm). */
export function prefetchAdjacentStatsMonths(
  queryClient: QueryClient,
  args: PrefetchStatsMonthsArgs
): void {
  for (const focus of nearbyMonthFocuses(args.focus)) {
    prefetchStatsMonth(queryClient, { ...args, focus });
  }
}
