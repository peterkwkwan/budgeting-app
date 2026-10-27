/**
 * Transactions sync: push the outbox, then pull remote changes and merge LWW.
 * Tie on `updated_at` keeps the remote row. A failed push stays in the outbox.
 * Does not import Supabase or NetInfo until a real sync runs without injected deps.
 */
import type { Transaction } from '@/lib/transactionModel';

import { logOffline } from './log';
import { listOpenOutbox, enqueueTransactionChange } from './outbox';
import {
  getTransactionLocalAny,
  upsertTransactionLocal,
} from './transactionsLocal';
import {
  withSqlTransaction,
  type SqlExecutor,
} from './schema';
import type {
  OutboxOp,
  OutboxRow,
  PendingOp,
  SyncMetaRow,
  TransactionLocalRow,
} from './types';

/** Full pull cursor. Every real `updated_at` is after this. */
export const FULL_PULL_SINCE = '1970-01-01T00:00:00.000Z';

export type SyncRemote = {
  createTransaction(row: TransactionLocalRow): Promise<Transaction>;
  /**
   * Conditional update when `baseUpdatedAt` is set.
   * Null base forces the local row, including clearing a remote tombstone.
   * Null result means no row matched.
   */
  updateTransaction(
    row: TransactionLocalRow,
    baseUpdatedAt: string | null
  ): Promise<Transaction | null>;
  softDeleteTransaction(
    id: string,
    deletedAt: string,
    baseUpdatedAt: string | null
  ): Promise<boolean>;
  /** Includes soft-deleted tombstones. */
  getTransaction(id: string): Promise<Transaction | null>;
  /** Includes soft-deleted tombstones, ordered by `updated_at`. */
  listTransactionsSince(since: string): Promise<Transaction[]>;
};

export type SyncEngineOptions = {
  db?: SqlExecutor;
  remote?: SyncRemote;
  isOnline?: () => Promise<boolean>;
  now?: () => string;
  newId?: () => string;
};

export type PushResult = {
  pushed: number;
  failed: number;
  dropped: number;
  firstError: string | null;
};

export type PullResult = {
  applied: number;
  keptLocal: number;
  lastPulledAt: string | null;
};

export type SyncNowResult = {
  skipped: boolean;
  pushed: number;
  failed: number;
  dropped: number;
  pulled: number;
  keptLocal: number;
  lastPulledAt: string | null;
};

type PushOneStatus = 'acked' | 'failed' | 'dropped' | 'stale';

/**
 * Compare ISO timestamps. Negative when `a` is earlier.
 * Unparseable values fall back to string order.
 */
export function compareUpdatedAt(a: string, b: string): number {
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (Number.isNaN(left) || Number.isNaN(right)) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Remote wins when it is newer or the timestamps are equal. No local row loses. */
export function remoteWinsLww(
  localUpdatedAt: string | null | undefined,
  remoteUpdatedAt: string
): boolean {
  if (localUpdatedAt == null) return true;
  return compareUpdatedAt(localUpdatedAt, remoteUpdatedAt) <= 0;
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code =
    'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  if (code === '23505') return true;
  const message = error instanceof Error ? error.message : '';
  return /duplicate key|unique constraint/i.test(message);
}

export async function readSyncMeta(
  db: SqlExecutor,
  userId: string
): Promise<SyncMetaRow | null> {
  const row = await db.first<Record<string, unknown>>(
    `SELECT user_id, last_pulled_at, last_sync_at, last_sync_error
     FROM sync_meta WHERE user_id = ?`,
    [userId]
  );
  if (!row) return null;
  return {
    user_id: String(row.user_id),
    last_pulled_at:
      row.last_pulled_at == null ? null : String(row.last_pulled_at),
    last_sync_at: row.last_sync_at == null ? null : String(row.last_sync_at),
    last_sync_error:
      row.last_sync_error == null ? null : String(row.last_sync_error),
  };
}

/** Remove this user's mirror, outbox, category cache, and cursor. Other users stay. */
export async function clearOfflineUserData(
  db: SqlExecutor,
  userId: string
): Promise<void> {
  await withSqlTransaction(db, async () => {
    await db.run('DELETE FROM outbox WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM transactions_local WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM sync_meta WHERE user_id = ?', [userId]);
    await db.run('DELETE FROM category_cache WHERE user_id = ?', [userId]);
  });
}

/**
 * Drop this user's local mirror and pull every remote row from epoch.
 * Used after restore and after a currency convert, when the server rewrote history.
 */
export async function resetLocalAndFullPull(
  userId: string,
  options?: SyncEngineOptions
): Promise<PullResult> {
  const db = options?.db ?? (await openDefaultDb());
  const remote = options?.remote ?? (await defaultRemote());
  await clearOfflineUserData(db, userId);
  return pullRemote(db, userId, remote, options);
}

/**
 * After an online stop or edit-future. Those RPCs can hard-delete future instances,
 * which an incremental pull cannot see. Push first. A failed push keeps the outbox.
 * A clean push is followed by a full reset and pull.
 */
export async function resyncAfterSeriesHardDelete(
  userId: string,
  options?: SyncEngineOptions
): Promise<'reset' | 'kept'> {
  const db = options?.db ?? (await openDefaultDb());
  const remote = options?.remote ?? (await defaultRemote());
  const open = await listOpenOutbox(db, userId);
  if (open.length > 0) {
    const push = await pushOutbox(db, userId, remote, options);
    if (push.failed > 0) return 'kept';
  }
  await clearOfflineUserData(db, userId);
  await pullRemote(db, userId, remote, options);
  return 'reset';
}

/** Sign-out helper. Opens the device DB when `db` is omitted. */
export async function clearOfflineUser(
  userId: string,
  db?: SqlExecutor
): Promise<void> {
  const database = db ?? (await openDefaultDb());
  await clearOfflineUserData(database, userId);
}

/**
 * Drain open outbox rows in FIFO order.
 * A transport failure marks the row failed and leaves it queued.
 */
export async function pushOutbox(
  db: SqlExecutor,
  userId: string,
  remote: SyncRemote,
  options?: SyncEngineOptions
): Promise<PushResult> {
  const open = await listOpenOutbox(db, userId);
  const result: PushResult = {
    pushed: 0,
    failed: 0,
    dropped: 0,
    firstError: null,
  };
  for (const row of open) {
    const outcome = await pushOne(db, row, remote, options);
    if (outcome.status === 'acked') result.pushed += 1;
    else if (outcome.status === 'dropped') result.dropped += 1;
    else if (outcome.status === 'failed') {
      result.failed += 1;
      result.firstError ??= outcome.error;
    }
  }
  return result;
}

/**
 * Pull rows with `updated_at` after the cursor (epoch when this user has none)
 * and merge them. The cursor advances only after the whole batch is applied.
 */
export async function pullRemote(
  db: SqlExecutor,
  userId: string,
  remote: SyncRemote,
  options?: SyncEngineOptions
): Promise<PullResult> {
  const now = options?.now ?? (() => new Date().toISOString());
  const meta = await readSyncMeta(db, userId);
  const since = meta?.last_pulled_at ?? FULL_PULL_SINCE;
  let rows: Transaction[];
  try {
    rows = await remote.listTransactionsSince(since);
  } catch (error) {
    logOffline('pull failed', { op: 'pull' });
    await writeSyncMeta(db, {
      user_id: userId,
      last_pulled_at: meta?.last_pulled_at ?? null,
      last_sync_at: now(),
      last_sync_error: errorMessage(error),
    });
    throw error;
  }

  let applied = 0;
  let keptLocal = 0;
  let maxSeen: string | null = null;
  try {
    await withSqlTransaction(db, async () => {
      for (const row of rows) {
        // Partner rows and any other user_id are never written.
        if (!isOwnTransaction(userId, row.user_id)) continue;
        if (Number.isNaN(Date.parse(row.updated_at))) {
          throw new Error('Remote transaction is missing updated_at.');
        }
        const outcome = await mergeRemoteTransaction(db, userId, row, options);
        if (outcome === 'applied') applied += 1;
        else keptLocal += 1;
        if (!maxSeen || compareUpdatedAt(row.updated_at, maxSeen) > 0) {
          maxSeen = row.updated_at;
        }
      }
      const lastPulledAt = maxSeen ?? meta?.last_pulled_at ?? null;
      await writeSyncMeta(db, {
        user_id: userId,
        last_pulled_at: lastPulledAt,
        last_sync_at: now(),
        last_sync_error: null,
      });
    });
  } catch (error) {
    logOffline('pull failed', { op: 'pull' });
    await writeSyncMeta(db, {
      user_id: userId,
      last_pulled_at: meta?.last_pulled_at ?? null,
      last_sync_at: now(),
      last_sync_error: errorMessage(error),
    });
    throw error;
  }

  const saved = await readSyncMeta(db, userId);
  return {
    applied,
    keptLocal,
    lastPulledAt: saved?.last_pulled_at ?? null,
  };
}

/** Online sync cycle. Always pushes, then pulls. Offline returns without either. */
export async function syncNow(
  userId: string,
  options?: SyncEngineOptions
): Promise<SyncNowResult> {
  const isOnline = options?.isOnline ?? defaultIsOnline;
  if (!(await isOnline())) {
    return {
      skipped: true,
      pushed: 0,
      failed: 0,
      dropped: 0,
      pulled: 0,
      keptLocal: 0,
      lastPulledAt: null,
    };
  }

  const db = options?.db ?? (await openDefaultDb());
  const remote = options?.remote ?? (await defaultRemote());
  const push = await pushOutbox(db, userId, remote, options);
  const pull = await pullRemote(db, userId, remote, options);
  if (push.firstError) {
    const meta = await readSyncMeta(db, userId);
    await writeSyncMeta(db, {
      user_id: userId,
      last_pulled_at: meta?.last_pulled_at ?? null,
      last_sync_at: meta?.last_sync_at ?? (options?.now ?? (() => new Date().toISOString()))(),
      last_sync_error: push.firstError,
    });
  }
  return {
    skipped: false,
    pushed: push.pushed,
    failed: push.failed,
    dropped: push.dropped,
    pulled: pull.applied,
    keptLocal: pull.keptLocal,
    lastPulledAt: pull.lastPulledAt,
  };
}

/**
 * Apply one remote row. Remote wins on a newer timestamp or a tie.
 * A strictly newer local row (or newer open outbox) is left in place.
 */
export async function mergeRemoteTransaction(
  db: SqlExecutor,
  userId: string,
  remote: Transaction,
  options?: SyncEngineOptions
): Promise<'applied' | 'kept_local'> {
  if (!isOwnTransaction(userId, remote.user_id)) return 'kept_local';
  const local = await getTransactionLocalAny(db, userId, remote.id);
  const open = await listOpenOutbox(db, userId, remote.id);
  const challenger = laterTimestamp(
    local?.updated_at ?? null,
    newestOutboxTimestamp(open)
  );
  if (challenger != null && !remoteWinsLww(challenger, remote.updated_at)) {
    if (local?.pending_op && open.length === 0) {
      await reenqueueLocal(db, local, remote.updated_at, options);
    }
    return 'kept_local';
  }

  for (const row of open) {
    await db.run('DELETE FROM outbox WHERE seq = ?', [row.seq]);
  }
  await upsertTransactionLocal(db, localFromRemote(remote));
  return 'applied';
}

async function pushOne(
  db: SqlExecutor,
  row: OutboxRow,
  remote: SyncRemote,
  options?: SyncEngineOptions
): Promise<{ status: PushOneStatus; error: string | null }> {
  try {
    if (row.op === 'create') {
      const payload = requireLocalRow(JSON.parse(row.payload_json), row);
      try {
        const saved = await remote.createTransaction(payload);
        const acked = await ackOutbox(db, row, saved);
        return acked
          ? { status: 'acked', error: null }
          : { status: 'stale', error: null };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const acked = await ackOutbox(db, row, null);
        return acked
          ? { status: 'acked', error: null }
          : { status: 'stale', error: null };
      }
    }

    if (row.op === 'update') {
      return pushUpdate(db, row, remote, options);
    }

    return pushSoftDelete(db, row, remote, options);
  } catch (error) {
    const message = await failOutbox(db, row, error);
    if (message == null) return { status: 'stale', error: null };
    logOffline('push failed', { op: row.op, id: row.entity_id });
    return { status: 'failed', error: message };
  }
}

async function pushUpdate(
  db: SqlExecutor,
  row: OutboxRow,
  remote: SyncRemote,
  options?: SyncEngineOptions
): Promise<{ status: PushOneStatus; error: string | null }> {
  const payload = requireLocalRow(JSON.parse(row.payload_json), row);
  const applied = await remote.updateTransaction(payload, row.base_updated_at);
  if (applied) {
    const acked = await ackOutbox(db, row, applied);
    return acked
      ? { status: 'acked', error: null }
      : { status: 'stale', error: null };
  }

  const current = await remote.getTransaction(row.entity_id);
  if (!current) {
    const message = await failOutbox(
      db,
      row,
      new Error('Remote transaction is missing.')
    );
    if (message == null) return { status: 'stale', error: null };
    return { status: 'failed', error: message };
  }

  const local = await getTransactionLocalAny(db, row.user_id, row.entity_id);
  const localTs = local?.updated_at ?? payload.updated_at;
  if (!remoteWinsLww(localTs, current.updated_at)) {
    const source = local ?? payload;
    const forced = await remote.updateTransaction(
      { ...source, id: row.entity_id, user_id: row.user_id },
      null
    );
    if (!forced) {
      const message = await failOutbox(
        db,
        row,
        new Error('Remote update did not apply.')
      );
      if (message == null) return { status: 'stale', error: null };
      return { status: 'failed', error: message };
    }
    const acked = await ackOutbox(db, row, forced);
    return acked
      ? { status: 'acked', error: null }
      : { status: 'stale', error: null };
  }

  const merged = await mergeInTransaction(db, row.user_id, current, options);
  return merged === 'applied'
    ? { status: 'dropped', error: null }
    : { status: 'stale', error: null };
}

async function mergeInTransaction(
  db: SqlExecutor,
  userId: string,
  remote: Transaction,
  options?: SyncEngineOptions
): Promise<'applied' | 'kept_local'> {
  let outcome: 'applied' | 'kept_local' = 'kept_local';
  await withSqlTransaction(db, async () => {
    outcome = await mergeRemoteTransaction(db, userId, remote, options);
  });
  return outcome;
}

async function pushSoftDelete(
  db: SqlExecutor,
  row: OutboxRow,
  remote: SyncRemote,
  options?: SyncEngineOptions
): Promise<{ status: PushOneStatus; error: string | null }> {
  const payload = requireDeletePayload(JSON.parse(row.payload_json));
  const applied = await remote.softDeleteTransaction(
    row.entity_id,
    payload.deleted_at,
    row.base_updated_at
  );
  if (applied) {
    const acked = await ackOutbox(db, row, null);
    return acked
      ? { status: 'acked', error: null }
      : { status: 'stale', error: null };
  }

  const current = await remote.getTransaction(row.entity_id);
  if (!current) {
    const message = await failOutbox(
      db,
      row,
      new Error('Remote transaction is missing.')
    );
    if (message == null) return { status: 'stale', error: null };
    return { status: 'failed', error: message };
  }
  if (current.deleted_at) {
    const acked = await ackOutbox(db, row, current);
    return acked
      ? { status: 'acked', error: null }
      : { status: 'stale', error: null };
  }

  const local = await getTransactionLocalAny(db, row.user_id, row.entity_id);
  const localTs = local?.updated_at ?? payload.deleted_at;
  if (!remoteWinsLww(localTs, current.updated_at)) {
    const forced = await remote.softDeleteTransaction(
      row.entity_id,
      payload.deleted_at,
      null
    );
    if (!forced) {
      const message = await failOutbox(
        db,
        row,
        new Error('Remote soft-delete did not apply.')
      );
      if (message == null) return { status: 'stale', error: null };
      return { status: 'failed', error: message };
    }
    const acked = await ackOutbox(db, row, null);
    return acked
      ? { status: 'acked', error: null }
      : { status: 'stale', error: null };
  }

  const merged = await mergeInTransaction(db, row.user_id, current, options);
  return merged === 'applied'
    ? { status: 'dropped', error: null }
    : { status: 'stale', error: null };
}

async function ackOutbox(
  db: SqlExecutor,
  row: OutboxRow,
  server: Transaction | null
): Promise<boolean> {
  let acked = false;
  await withSqlTransaction(db, async () => {
    await db.run(
      `UPDATE outbox
       SET status = 'acked', last_error = NULL
       WHERE seq = ? AND payload_json = ? AND status IN ('pending', 'failed')`,
      [row.seq, row.payload_json]
    );
    const current = await db.first<{ status: string; payload_json: string }>(
      'SELECT status, payload_json FROM outbox WHERE seq = ?',
      [row.seq]
    );
    if (
      !current ||
      current.payload_json !== row.payload_json ||
      current.status !== 'acked'
    ) {
      return;
    }
    acked = true;
    const ts = outboxTimestamp(row);
    const local = await getTransactionLocalAny(db, row.user_id, row.entity_id);
    // This push landed and the local row was not edited again. Keep the
    // server copy (its updated_at is the trigger clock) so later pulls converge.
    if (server && local && ts && local.updated_at === ts) {
      await upsertTransactionLocal(db, localFromRemote(server));
      return;
    }
    if (ts) {
      await db.run(
        `UPDATE transactions_local
         SET pending_op = NULL
         WHERE user_id = ? AND id = ? AND updated_at = ?`,
        [row.user_id, row.entity_id, ts]
      );
    }
  });
  return acked;
}

/** Returns the stored error, or null when the row changed and was left queued. */
async function failOutbox(
  db: SqlExecutor,
  row: OutboxRow,
  error: unknown
): Promise<string | null> {
  const message = errorMessage(error);
  await db.run(
    `UPDATE outbox
     SET status = 'failed', attempts = attempts + 1, last_error = ?
     WHERE seq = ? AND payload_json = ? AND status IN ('pending', 'failed')`,
    [message, row.seq, row.payload_json]
  );
  const current = await db.first<{ payload_json: string; status: string }>(
    'SELECT payload_json, status FROM outbox WHERE seq = ?',
    [row.seq]
  );
  if (!current || current.payload_json !== row.payload_json) return null;
  if (current.status !== 'failed') return null;
  return message;
}

async function reenqueueLocal(
  db: SqlExecutor,
  local: TransactionLocalRow,
  baseUpdatedAt: string,
  options?: SyncEngineOptions
): Promise<void> {
  if (!local.pending_op) return;
  const op = pendingToOp(local.pending_op);
  const now = options?.now?.() ?? new Date().toISOString();
  if (op === 'soft_delete') {
    if (!local.deleted_at) return;
    await enqueueTransactionChange(db, {
      userId: local.user_id,
      entityId: local.id,
      op,
      payload: { id: local.id, deleted_at: local.deleted_at },
      baseUpdatedAt,
      now,
      outboxId: await nextOutboxId(options?.newId),
    });
    return;
  }
  await enqueueTransactionChange(db, {
    userId: local.user_id,
    entityId: local.id,
    op,
    payload: local,
    baseUpdatedAt: op === 'create' ? null : baseUpdatedAt,
    now,
    outboxId: await nextOutboxId(options?.newId),
  });
}

function pendingToOp(pending: PendingOp): OutboxOp {
  if (pending === 'delete') return 'soft_delete';
  return pending;
}

function localFromRemote(remote: Transaction): TransactionLocalRow {
  return {
    id: remote.id,
    user_id: remote.user_id,
    amount: remote.amount,
    type: remote.type,
    category: remote.category,
    note: remote.note,
    currency: remote.currency,
    occurred_at: remote.occurred_at,
    recurring_series_id: remote.recurring_series_id,
    occurrence_key: remote.occurrence_key,
    deleted_at: remote.deleted_at,
    created_at: remote.created_at,
    updated_at: remote.updated_at,
    pending_op: null,
  };
}

function newestOutboxTimestamp(rows: OutboxRow[]): string | null {
  let newest: string | null = null;
  for (const row of rows) {
    const ts = outboxTimestamp(row);
    if (!ts) continue;
    if (!newest || compareUpdatedAt(ts, newest) > 0) newest = ts;
  }
  return newest;
}

function laterTimestamp(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return compareUpdatedAt(a, b) >= 0 ? a : b;
}

function outboxTimestamp(row: OutboxRow): string | null {
  try {
    const payload = JSON.parse(row.payload_json) as {
      updated_at?: unknown;
      deleted_at?: unknown;
    };
    if (row.op === 'soft_delete') {
      return typeof payload.deleted_at === 'string' ? payload.deleted_at : null;
    }
    return typeof payload.updated_at === 'string' ? payload.updated_at : null;
  } catch {
    return null;
  }
}

function requireLocalRow(
  value: unknown,
  row: OutboxRow
): TransactionLocalRow {
  if (!value || typeof value !== 'object') {
    throw new Error('Bad outbox payload.');
  }
  const payload = value as Partial<TransactionLocalRow>;
  if (payload.type !== 'expense' && payload.type !== 'income') {
    throw new Error('Bad outbox payload.');
  }
  if (typeof payload.amount !== 'number' || typeof payload.category !== 'string') {
    throw new Error('Bad outbox payload.');
  }
  if (typeof payload.occurred_at !== 'string') {
    throw new Error('Bad outbox payload.');
  }
  const updatedAt =
    typeof payload.updated_at === 'string' ? payload.updated_at : null;
  if (!updatedAt) throw new Error('Bad outbox payload.');
  return {
    id: row.entity_id,
    user_id: row.user_id,
    amount: payload.amount,
    type: payload.type,
    category: payload.category,
    note: payload.note ?? null,
    currency: typeof payload.currency === 'string' ? payload.currency : 'HKD',
    occurred_at: payload.occurred_at,
    recurring_series_id: payload.recurring_series_id ?? null,
    occurrence_key: payload.occurrence_key ?? null,
    deleted_at: payload.deleted_at ?? null,
    created_at:
      typeof payload.created_at === 'string' ? payload.created_at : updatedAt,
    updated_at: updatedAt,
    pending_op: payload.pending_op ?? null,
  };
}

function requireDeletePayload(value: unknown): { deleted_at: string } {
  if (!value || typeof value !== 'object') {
    throw new Error('Bad outbox payload.');
  }
  const payload = value as { deleted_at?: unknown };
  if (typeof payload.deleted_at !== 'string') {
    throw new Error('Bad outbox payload.');
  }
  return { deleted_at: payload.deleted_at };
}

/** True only for the signed-in user. Partner rows fail this and are not inserted. */
function isOwnTransaction(userId: string, rowUserId: string): boolean {
  return userId.length > 0 && rowUserId === userId;
}

function errorMessage(error: unknown): string {
  const message =
    error instanceof Error && error.message
      ? error.message
      : 'Sync push failed.';
  return message.slice(0, 500);
}

async function writeSyncMeta(db: SqlExecutor, row: SyncMetaRow): Promise<void> {
  await db.run(
    `INSERT INTO sync_meta (user_id, last_pulled_at, last_sync_at, last_sync_error)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       last_pulled_at = excluded.last_pulled_at,
       last_sync_at = excluded.last_sync_at,
       last_sync_error = excluded.last_sync_error`,
    [row.user_id, row.last_pulled_at, row.last_sync_at, row.last_sync_error]
  );
}

async function nextOutboxId(explicit?: () => string): Promise<string> {
  if (explicit) return explicit();
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  const { newClientId } = await import('./ids');
  return newClientId();
}

async function openDefaultDb(): Promise<SqlExecutor> {
  const { getOfflineDb } = await import('./db');
  return getOfflineDb();
}

async function defaultIsOnline(): Promise<boolean> {
  const { isDeviceOnline } = await import('./net');
  return isDeviceOnline();
}

async function defaultRemote(): Promise<SyncRemote> {
  const tx = await import('../transactions');
  return {
    createTransaction(row) {
      return tx.insertOwnTransaction(row);
    },
    updateTransaction(row, baseUpdatedAt) {
      return tx.updateOwnTransaction(row, baseUpdatedAt);
    },
    softDeleteTransaction(id, deletedAt, baseUpdatedAt) {
      return tx.softDeleteOwnTransaction(id, deletedAt, baseUpdatedAt);
    },
    getTransaction(id) {
      return tx.getTransactionIncludingDeleted(id);
    },
    listTransactionsSince(since) {
      return tx.listTransactionsSince(since);
    },
  };
}
