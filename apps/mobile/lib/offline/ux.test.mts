/**
 * Phase 3: banner, pending badge, and online-only gates.
 * Pure copy rules plus the SQLite status reader. No device and no NetInfo.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import type { TransactionInput } from '../transactionModel.ts';
import { OFFLINE_TXNS_ENABLED } from './flag.ts';
import { enqueueTransactionChange } from './outbox.ts';
import {
  migrateOfflineSchema,
  type SqlExecutor,
  type SqlValue,
} from './schema.ts';
import { createLocalTransaction } from './transactionsRepo.ts';
import { upsertTransactionLocal } from './transactionsLocal.ts';
import type { TransactionLocalRow } from './types.ts';
import {
  NEEDS_INTERNET_COPY,
  OFFLINE_BANNER_COPY,
  PENDING_SYNC_COPY,
  REPEAT_BLOCKED_COPY,
  SAVED_ON_PHONE_COPY,
  STATS_OFFLINE_COPY,
  SYNCING_COPY,
  blockedActionHint,
  blockedOnlineAction,
  isPendingSync,
  offlineBannerCopy,
} from './ux.ts';
import { readOfflineUxStatus } from './uxStatus.ts';

function nodeSql(db: DatabaseSync): SqlExecutor {
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params = []) {
      const stmt = db.prepare(sql);
      if (params.length === 0) stmt.run();
      else stmt.run(...(params as SqlValue[]));
    },
    async all<Row>(sql: string, params: readonly SqlValue[] = []) {
      const stmt = db.prepare(sql);
      const rows =
        params.length === 0 ? stmt.all() : stmt.all(...(params as SqlValue[]));
      return rows as Row[];
    },
    async first<Row>(sql: string, params: readonly SqlValue[] = []) {
      const stmt = db.prepare(sql);
      const row =
        params.length === 0 ? stmt.get() : stmt.get(...(params as SqlValue[]));
      return (row as Row | undefined) ?? null;
    },
  };
}

async function freshDb(): Promise<SqlExecutor> {
  const db = nodeSql(new DatabaseSync(':memory:'));
  await migrateOfflineSchema(db);
  return db;
}

const input: TransactionInput = {
  amount: 12,
  type: 'expense',
  category: 'Groceries',
  occurred_at: '2026-10-27T12:00:00.000Z',
};

describe('offline flag', () => {
  it('is on so transactions show the offline chrome', () => {
    assert.equal(OFFLINE_TXNS_ENABLED, true);
  });

  it('hides chrome when the caller passes enabled false', () => {
    assert.equal(
      offlineBannerCopy({
        enabled: false,
        online: false,
        openCount: 3,
        lastSyncError: 'nope',
      }),
      null
    );
    assert.equal(
      blockedOnlineAction({
        enabled: false,
        online: false,
        outboxPending: true,
        blockOnPending: true,
      }),
      null
    );
  });
});

describe('offline banner', () => {
  it('shows the offline sentence even when nothing is pending', () => {
    assert.equal(
      offlineBannerCopy({
        enabled: true,
        online: false,
        openCount: 0,
        lastSyncError: null,
      }),
      OFFLINE_BANNER_COPY
    );
  });

  it('hides when online and the outbox is empty', () => {
    assert.equal(
      offlineBannerCopy({
        enabled: true,
        online: true,
        openCount: 0,
        lastSyncError: 'stale',
      }),
      null
    );
  });

  it('says sync will retry when an online flush left rows queued', () => {
    assert.equal(
      offlineBannerCopy({
        enabled: true,
        online: true,
        openCount: 1,
        lastSyncError: 'network',
      }),
      SAVED_ON_PHONE_COPY
    );
  });

  it('says syncing while online with queued rows and no error yet', () => {
    assert.equal(
      offlineBannerCopy({
        enabled: true,
        online: true,
        openCount: 2,
        lastSyncError: null,
      }),
      SYNCING_COPY
    );
  });
});

describe('online-only gates', () => {
  it('blocks repeat, stats, and wipe only while offline', () => {
    assert.equal(
      blockedOnlineAction({ enabled: true, online: false }),
      'offline'
    );
    assert.equal(blockedActionHint('offline'), NEEDS_INTERNET_COPY);
    assert.equal(
      blockedOnlineAction({
        enabled: true,
        online: true,
        outboxPending: true,
      }),
      null
    );
    assert.equal(REPEAT_BLOCKED_COPY.includes('repeating transactions'), true);
    assert.equal(STATS_OFFLINE_COPY, 'Stats need a connection.');
  });

  it('blocks partner, currency, and categories while offline or pending', () => {
    assert.equal(
      blockedOnlineAction({
        enabled: true,
        online: false,
        outboxPending: false,
        blockOnPending: true,
      }),
      'offline'
    );
    assert.equal(
      blockedOnlineAction({
        enabled: true,
        online: true,
        outboxPending: true,
        blockOnPending: true,
      }),
      'pending'
    );
    assert.equal(blockedActionHint('pending'), PENDING_SYNC_COPY);
    assert.equal(
      blockedOnlineAction({
        enabled: true,
        online: true,
        outboxPending: false,
        blockOnPending: true,
      }),
      null
    );
  });
});

describe('pending sync status', () => {
  it('badges a row with pending_op or an open outbox entry', () => {
    assert.equal(isPendingSync('create', false), true);
    assert.equal(isPendingSync(null, true), true);
    assert.equal(isPendingSync(null, false), false);
    assert.equal(isPendingSync(undefined, false), false);
  });

  it('clears the badge after the outbox and pending_op are gone', async () => {
    const db = await freshDb();
    let n = 0;
    const options = {
      db,
      now: () => '2026-10-27T12:00:00.000Z',
      newId: () => `id-${++n}`,
    };
    const created = await createLocalTransaction('user-a', input, 'HKD', options);
    const open = await readOfflineUxStatus(db, 'user-a');
    assert.equal(open.openCount, 1);
    assert.deepEqual(open.pendingIds, [created.id]);
    assert.equal(isPendingSync('create', open.pendingIds.includes(created.id)), true);

    await db.run(
      `UPDATE transactions_local SET pending_op = NULL WHERE id = ?`,
      [created.id]
    );
    const outboxOnly = await readOfflineUxStatus(db, 'user-a');
    assert.equal(outboxOnly.openCount, 1);
    assert.deepEqual(outboxOnly.pendingIds, [created.id]);

    await db.run(`DELETE FROM outbox WHERE entity_id = ?`, [created.id]);
    const synced = await readOfflineUxStatus(db, 'user-a');
    assert.equal(synced.openCount, 0);
    assert.deepEqual(synced.pendingIds, []);
    assert.equal(isPendingSync(null, synced.pendingIds.includes(created.id)), false);
  });

  it('includes a pending_op with no outbox row, and reads the last sync error', async () => {
    const db = await freshDb();
    const row: TransactionLocalRow = {
      id: 'local-only',
      user_id: 'user-a',
      amount: 4,
      type: 'income',
      category: 'Salary',
      note: null,
      currency: 'HKD',
      occurred_at: '2026-10-27T12:00:00.000Z',
      recurring_series_id: null,
      occurrence_key: null,
      deleted_at: null,
      created_at: '2026-10-27T12:00:00.000Z',
      updated_at: '2026-10-27T12:00:00.000Z',
      pending_op: 'update',
    };
    await upsertTransactionLocal(db, row);
    await enqueueTransactionChange(db, {
      userId: 'user-a',
      entityId: 'other',
      op: 'update',
      payload: { id: 'other' },
      baseUpdatedAt: null,
      now: '2026-10-27T12:00:00.000Z',
      outboxId: 'ob-1',
    });
    await db.run(
      `INSERT INTO sync_meta (user_id, last_pulled_at, last_sync_at, last_sync_error)
       VALUES ('user-a', NULL, '2026-10-27T12:01:00.000Z', 'timeout')`
    );

    const status = await readOfflineUxStatus(db, 'user-a');
    assert.equal(status.openCount, 1);
    assert.equal(status.lastSyncError, 'timeout');
    assert.ok(status.pendingIds.includes('local-only'));
    assert.ok(status.pendingIds.includes('other'));
  });
});
