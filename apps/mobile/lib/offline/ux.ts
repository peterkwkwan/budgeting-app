/**
 * Phase 3 copy and visibility rules for transactions-only offline.
 * Pure: no NetInfo, no SQLite. Screens hide every branch while the flag is off.
 */

export const OFFLINE_BANNER_COPY =
  'You’re offline. Transaction changes save on this phone and sync when you’re back.';

export const PENDING_SYNC_COPY = 'Pending sync';

export const REPEAT_BLOCKED_COPY =
  'Connect to the internet to set up repeating transactions.';

export const STATS_OFFLINE_COPY = 'Stats need a connection.';

export const PLANNER_OFFLINE_COPY = 'Planner needs a connection.';

export const NEEDS_INTERNET_COPY = 'Needs internet.';

export const SAVED_ON_PHONE_COPY = 'Saved on phone — sync will retry.';

export const SYNCING_COPY = 'Syncing…';

export const offlineUxKeys = {
  all: ['offline-ux'] as const,
  status: (userId: string) => ['offline-ux', 'status', userId] as const,
};

export type OfflineUxStatus = {
  /** Transaction ids with pending_op or an open outbox row. */
  pendingIds: string[];
  /** Open outbox rows (pending or failed). */
  openCount: number;
  lastSyncError: string | null;
};

/**
 * Banner on Transactions and Add/Edit.
 * Hidden when the flag is off, and when online with an empty outbox.
 */
export function offlineBannerCopy(input: {
  enabled: boolean;
  online: boolean;
  openCount: number;
  lastSyncError: string | null;
}): string | null {
  if (!input.enabled) return null;
  if (!input.online) return OFFLINE_BANNER_COPY;
  if (input.openCount === 0) return null;
  if (input.lastSyncError) return SAVED_ON_PHONE_COPY;
  return SYNCING_COPY;
}

/** Row or detail badge. True when the mirror says pending or the outbox is open. */
export function isPendingSync(
  pendingOp: string | null | undefined,
  openOutbox: boolean
): boolean {
  return (pendingOp != null && pendingOp !== '') || openOutbox;
}

export type OnlineBlockReason = 'offline' | 'pending';

/**
 * Online-only actions.
 * Repeat, recurring, stats, planner, and wipe use offline only.
 * Partner, currency, and categories also block while the outbox is open.
 */
export function blockedOnlineAction(input: {
  enabled: boolean;
  online: boolean;
  outboxPending?: boolean;
  blockOnPending?: boolean;
}): OnlineBlockReason | null {
  if (!input.enabled) return null;
  if (!input.online) return 'offline';
  if (input.blockOnPending && input.outboxPending) return 'pending';
  return null;
}

/** Short hint for a disabled partner, currency, category, or account-data control. */
export function blockedActionHint(reason: OnlineBlockReason | null): string | null {
  if (reason === 'offline') return NEEDS_INTERNET_COPY;
  if (reason === 'pending') return PENDING_SYNC_COPY;
  return null;
}
