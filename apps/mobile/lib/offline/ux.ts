/**
 * Phase 3 copy and visibility rules for transactions-only offline.
 * Pure: no NetInfo, no SQLite. Screens hide every branch while the flag is off.
 */

export const OFFLINE_BANNER_COPY =
  'You’re offline. Transaction changes save on this phone and sync when you’re back.';

/** Account / Settings top banner while offline (inline “Needs internet.” removed). */
export const SETTINGS_OFFLINE_BANNER_COPY =
  'You’re offline. Some settings are disabled and will be available when you’re back online.';

export const PENDING_SYNC_COPY = 'Pending sync';

export const REPEAT_BLOCKED_COPY =
  'Connect to the internet to set up repeating transactions.';

/** Pair / partner Stats still need the network. */
export const STATS_OFFLINE_COPY = 'Partner stats need a connection.';

/**
 * Banner message for personal Stats while offline (pass to OfflineBanner).
 * Pair stays blocked; do not reuse the Transactions offline copy.
 */
export const STATS_PERSONAL_OFFLINE_BANNER =
  'Personal stats use data on this phone. Partner stats need a connection.';

export const PLANNER_OFFLINE_COPY = 'Planner needs a connection.';

export const SAVED_ON_PHONE_COPY = 'Saved on phone — sync will retry.';

export const SYNCING_COPY = 'Syncing…';

/** Wipe confirm when the outbox still has rows (plan D2). */
export const UNSYNCED_DISCARD_COPY = 'Unsynced changes will be discarded.';

/** Currency convert while local edits have not reached the server. */
export const SYNC_BEFORE_CONVERT_COPY = 'Sync pending changes first.';

/** Push rejected the category. The outbox row stays so the user can edit it. */
export const CATEGORY_FIX_COPY =
  'That category isn’t available. Edit the transaction and pick another.';

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
  /** Open rows whose push failed because the category is no longer allowed. */
  categoryFixIds: string[];
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
  if (isInvalidCategoryError(input.lastSyncError)) return CATEGORY_FIX_COPY;
  if (input.lastSyncError) return SAVED_ON_PHONE_COPY;
  return SYNCING_COPY;
}

/**
 * Banner on Account and Settings.
 * Offline only — pending-sync still uses the short inline hint.
 */
export function settingsOfflineBannerCopy(input: {
  enabled: boolean;
  online: boolean;
}): string | null {
  if (!input.enabled || input.online) return null;
  return SETTINGS_OFFLINE_BANNER_COPY;
}

/** Server trigger: `Category "…" is not allowed for expense|income`. */
export function isInvalidCategoryError(
  message: string | null | undefined
): boolean {
  if (!message) return false;
  return /is not allowed/i.test(message);
}

/** Extra wipe sentence. Null when the outbox is empty — nothing to discard. */
export function wipeDiscardNotice(outboxOpen: boolean): string | null {
  return outboxOpen ? UNSYNCED_DISCARD_COPY : null;
}

/**
 * Convert is online-only and blocked while the outbox is open.
 * Pending asks the user to sync first so a convert cannot race local amounts.
 */
export function currencyConvertHint(input: {
  enabled: boolean;
  online: boolean;
  outboxPending: boolean;
}): string | null {
  const reason = blockedOnlineAction({
    enabled: input.enabled,
    online: input.online,
    outboxPending: input.outboxPending,
    blockOnPending: true,
  });
  // Offline copy lives on the settings Offline banner.
  if (reason === 'offline') return null;
  if (reason === 'pending') return SYNC_BEFORE_CONVERT_COPY;
  return null;
}

/** Series create, edit-future, and stop stay online. Never an outbox op. */
export function seriesChangeBlocked(enabled: boolean, online: boolean): boolean {
  return enabled && !online;
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
 * Repeat, recurring, pair stats, planner, and wipe use offline only.
 * Personal Stats read the local mirror when offline (see statsLocal).
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

/**
 * Short hint for a disabled partner, currency, or category control.
 * Offline uses the settings banner instead of an inline “Needs internet.”
 */
export function blockedActionHint(reason: OnlineBlockReason | null): string | null {
  if (reason === 'offline') return null;
  if (reason === 'pending') return PENDING_SYNC_COPY;
  return null;
}
