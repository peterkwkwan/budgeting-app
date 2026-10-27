/**
 * Reads pending-badge and banner inputs from SQLite.
 * Called only when OFFLINE_TXNS_ENABLED is true.
 */
import { listOpenOutbox } from './outbox';
import type { SqlExecutor } from './schema';
import { readSyncMeta } from './syncEngine';
import { isInvalidCategoryError, type OfflineUxStatus } from './ux';

export async function readOfflineUxStatus(
  db: SqlExecutor,
  userId: string
): Promise<OfflineUxStatus> {
  const open = await listOpenOutbox(db, userId);
  const pendingRows = await db.all<{ id: string }>(
    `SELECT id FROM transactions_local
     WHERE user_id = ? AND pending_op IS NOT NULL`,
    [userId]
  );
  const meta = await readSyncMeta(db, userId);
  const pendingIds = new Set<string>();
  for (const row of open) pendingIds.add(row.entity_id);
  for (const row of pendingRows) pendingIds.add(String(row.id));
  return {
    pendingIds: [...pendingIds],
    openCount: open.length,
    lastSyncError: meta?.last_sync_error ?? null,
    categoryFixIds: open
      .filter((row) => isInvalidCategoryError(row.last_error))
      .map((row) => row.entity_id),
  };
}
