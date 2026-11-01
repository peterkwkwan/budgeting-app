import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { TransactionType } from '@/constants/categories';
import { useAuth } from '@/lib/auth';
import { useConnectivity } from '@/hooks/useConnectivity';
import {
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
 * While viewing month M, warm caches for M−1 and M+1 so peeks and settle
 * render ready data (skeleton only when truly uncached).
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
 * Keep the shared transactions list warm. Adjacent months are filtered
 * client-side from the same cache (list + calendar peeks).
 */
export function usePrefetchTransactionMonths(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    void prefetchTransactionList(queryClient);
  }, [queryClient, enabled]);
}
