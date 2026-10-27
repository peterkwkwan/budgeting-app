import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/lib/auth';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { offlineUxKeys, type OfflineUxStatus } from '@/lib/offline/ux';

const EMPTY: OfflineUxStatus = {
  pendingIds: [],
  openCount: 0,
  lastSyncError: null,
};

/**
 * Open outbox and pending_op ids for badges and gates.
 * The query does not run while the flag is off, so SQLite stays closed.
 */
export function useSyncStatus() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: offlineUxKeys.status(userId ?? 'signed-out'),
    enabled: OFFLINE_TXNS_ENABLED && Boolean(userId),
    queryFn: async (): Promise<OfflineUxStatus> => {
      const { getOfflineDb } = await import('@/lib/offline/db');
      const { readOfflineUxStatus } = await import('@/lib/offline/uxStatus');
      const db = await getOfflineDb();
      return readOfflineUxStatus(db, userId!);
    },
  });

  const data = OFFLINE_TXNS_ENABLED && userId ? (query.data ?? EMPTY) : EMPTY;
  const pendingIds = useMemo(
    () => new Set(data.pendingIds),
    [data.pendingIds]
  );

  return {
    pendingIds,
    openCount: data.openCount,
    lastSyncError: data.lastSyncError,
  };
}
