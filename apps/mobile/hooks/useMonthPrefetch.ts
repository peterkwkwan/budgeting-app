import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { TransactionType } from '@/constants/categories';
import { useAuth } from '@/lib/auth';
import { useConnectivity } from '@/hooks/useConnectivity';
import {
  areAdjacentStatsMonthsCached,
  prefetchAdjacentStatsMonths,
  prefetchTransactionList,
} from '@/lib/monthPrefetch';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import type { PeriodFocus } from '@/lib/periods';
import type { StatsMetric } from '@/lib/stats';

/** Offline + flag: personal Stats from SQLite (mirrors usePersonalStats). */
function usePersonalStatsLocal(): boolean {
  const { online, ready } = useConnectivity();
  if (!OFFLINE_TXNS_ENABLED) return false;
  if (!ready) return true;
  return !online;
}

/**
 * While viewing month M, warm caches for M±1 and M±2 so rapid swipes hit
 * ready data (skeleton only when truly uncached past the prefetch window).
 */
export function usePrefetchAdjacentStatsMonths(args: {
  focus: PeriodFocus;
  timeZone: string;
  pieType: TransactionType;
  pairLive: boolean;
  trendMetric: StatsMetric;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const useLocal = usePersonalStatsLocal();
  const {
    focus,
    timeZone,
    pieType,
    pairLive,
    trendMetric,
    enabled,
  } = args;

  useEffect(() => {
    if (!enabled) return;
    prefetchAdjacentStatsMonths(queryClient, {
      focus,
      timeZone,
      pieType,
      useLocal,
      userId: user?.id,
      pairLive,
      trendMetric: pairLive ? undefined : trendMetric,
    });
  }, [
    queryClient,
    enabled,
    focus.year,
    focus.month,
    timeZone,
    pieType,
    useLocal,
    user?.id,
    pairLive,
    trendMetric,
  ]);
}

/**
 * True when Stats totals for the visible M±1 neighbors are already cached.
 * Re-subscribes to the query cache until both neighbors are warm.
 */
export function useAdjacentStatsMonthsReady(args: {
  focus: PeriodFocus;
  timeZone: string;
  pairLive: boolean;
  enabled: boolean;
}): boolean {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const useLocal = usePersonalStatsLocal();
  const { focus, timeZone, pairLive, enabled } = args;
  const [cacheEpoch, setCacheEpoch] = useState(0);

  const ready =
    !enabled ||
    areAdjacentStatsMonthsCached(queryClient, {
      focus,
      timeZone,
      useLocal,
      userId: user?.id,
      pairLive,
    });

  useEffect(() => {
    if (!enabled || ready) return;
    return queryClient.getQueryCache().subscribe(() => {
      setCacheEpoch((n) => n + 1);
    });
  }, [queryClient, enabled, ready, focus.year, focus.month]);

  // cacheEpoch forces a re-read of the query cache after updates.
  void cacheEpoch;
  return ready;
}

/**
 * Keep the shared transactions list warm. Adjacent months are filtered
 * client-side from the same cache (three full month bodies).
 */
export function usePrefetchTransactionMonths(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    void prefetchTransactionList(queryClient);
  }, [queryClient, enabled]);
}
