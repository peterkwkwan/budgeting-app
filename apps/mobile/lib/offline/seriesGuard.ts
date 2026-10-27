/**
 * Recurring series create, edit-future, and stop are online RPCs.
 * They are never written to the transaction outbox.
 */
import { OFFLINE_TXNS_ENABLED } from './flag';
import { REPEAT_BLOCKED_COPY, seriesChangeBlocked } from './ux';

export async function refuseOfflineSeriesChange(
  isOnline?: () => Promise<boolean>
): Promise<void> {
  if (!OFFLINE_TXNS_ENABLED) return;
  const online = isOnline
    ? await isOnline()
    : await import('./net').then((net) => net.isDeviceOnline());
  if (seriesChangeBlocked(true, online)) {
    throw new Error(REPEAT_BLOCKED_COPY);
  }
}
