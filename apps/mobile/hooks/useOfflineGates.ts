import { useConnectivity } from '@/hooks/useConnectivity';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import {
  blockedActionHint,
  blockedOnlineAction,
  offlineBannerCopy,
} from '@/lib/offline/ux';

/**
 * Phase 3 gates. Every flag is false while OFFLINE_TXNS_ENABLED is false,
 * so production screens stay on the online path.
 */
export function useOfflineGates() {
  const { online } = useConnectivity();
  const sync = useSyncStatus();
  const enabled = OFFLINE_TXNS_ENABLED;
  const offline = enabled && !online;
  const outboxPending = enabled && sync.openCount > 0;
  const manageReason = blockedOnlineAction({
    enabled,
    online,
    outboxPending,
    blockOnPending: true,
  });

  return {
    /** Flag on and NetInfo says offline. */
    offline,
    /** Flag on and the outbox still has pending or failed rows. */
    outboxPending,
    pendingIds: sync.pendingIds,
    banner: offlineBannerCopy({
      enabled,
      online,
      openCount: sync.openCount,
      lastSyncError: sync.lastSyncError,
    }),
    repeatBlocked: offline,
    recurringBlocked: offline,
    statsBlocked: offline,
    plannerBlocked: offline,
    /** Wipe, restore, delete account. Offline only — pending-outbox confirm is Phase 4. */
    accountDataBlocked: offline,
    /** Partner, currency, and category manage. */
    manageBlocked: manageReason != null,
    manageHint: blockedActionHint(manageReason),
  };
}
