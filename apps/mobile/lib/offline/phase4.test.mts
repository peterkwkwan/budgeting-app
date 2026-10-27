/**
 * Phase 4: recurring instances, wipe/restore reset, convert block, category fix.
 * In-memory SQLite. No device, no Supabase.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { filterTransactionsVisible } from '../transactionModel.ts';
import type { TransactionInput } from '../transactionModel.ts';
import {
  loadCachedOrFreshCategories,
  readCategoryCache,
  saveCategoryCache,
} from './categoryCache.ts';
import { OFFLINE_TXNS_ENABLED } from './flag.ts';
import { listOpenOutbox } from './outbox.ts';
import {
  OFFLINE_SCHEMA_V1_SQL,
  migrateOfflineSchema,
  type SqlExecutor,
  type SqlValue,
} from './schema.ts';
import { refuseOfflineSeriesChange } from './seriesGuard.ts';
import {
  FULL_PULL_SINCE,
  clearOfflineUserData,
  pushOutbox,
  resetLocalAndFullPull,
  resyncAfterSeriesHardDelete,
  type SyncRemote,
} from './syncEngine.ts';
import {
  createLocalTransaction,
  listLocalTransactions,
  softDeleteLocalTransaction,
  updateLocalTransaction,
  type TransactionsRepoOptions,
} from './transactionsRepo.ts';
import {
  listActiveTransactionsLocal,
  upsertTransactionLocal,
} from './transactionsLocal.ts';
import type { TransactionLocalRow } from './types.ts';
import { readOfflineUxStatus } from './uxStatus.ts';
import {
  CATEGORY_FIX_COPY,
  NEEDS_INTERNET_COPY,
  SYNC_BEFORE_CONVERT_COPY,
  UNSYNCED_DISCARD_COPY,
  currencyConvertHint,
  isInvalidCategoryError,
  offlineBannerCopy,
  seriesChangeBlocked,
  wipeDiscardNotice,
} from './ux.ts';

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

function repoOptions(db: SqlExecutor): TransactionsRepoOptions {
  let n = 0;
  return {
    db,
    now: () => '2026-10-27T12:00:00.000Z',
    newId: () => `id-${++n}`,
  };
}

function mirror(
  partial: Partial<TransactionLocalRow> &
    Pick<TransactionLocalRow, 'id' | 'occurred_at'>
): TransactionLocalRow {
  return {
    user_id: 'user-a',
    amount: 20,
    type: 'expense',
    category: 'Rent',
    note: null,
    currency: 'HKD',
    recurring_series_id: 'series-1',
    occurrence_key: '2026-10-20',
    deleted_at: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    pending_op: null,
    ...partial,
  };
}

function stubRemote(partial: Partial<SyncRemote> = {}): SyncRemote {
  return {
    async createTransaction() {
      throw new Error('unexpected create');
    },
    async updateTransaction() {
      throw new Error('unexpected update');
    },
    async softDeleteTransaction() {
      throw new Error('unexpected delete');
    },
    async getTransaction() {
      return null;
    },
    async listTransactionsSince() {
      return [];
    },
    ...partial,
  };
}

const editInput: TransactionInput = {
  amount: 25,
  type: 'expense',
  category: 'Rent',
  occurred_at: '2026-10-20T00:00:00.000Z',
};

describe('offline flag', () => {
  it('is on', () => {
    assert.equal(OFFLINE_TXNS_ENABLED, true);
  });
});

describe('recurring instances', () => {
  it('keeps a mirrored instance listable and hides a future one', async () => {
    const db = await freshDb();
    await upsertTransactionLocal(
      db,
      mirror({ id: 'past', occurred_at: '2026-10-20T00:00:00.000Z' })
    );
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'future',
        occurred_at: '2026-11-15T00:00:00.000Z',
        occurrence_key: '2026-11-15',
      })
    );
    const listed = await listLocalTransactions('user-a', { db });
    assert.deepEqual(
      listed.map((row) => row.id).sort(),
      ['future', 'past']
    );
    const visible = filterTransactionsVisible(
      listed,
      'UTC',
      new Date('2026-10-27T12:00:00.000Z')
    );
    assert.deepEqual(
      visible.map((row) => row.id),
      ['past']
    );
  });

  it('edits and deletes an instance as a transaction outbox op', async () => {
    const db = await freshDb();
    const options = repoOptions(db);
    await upsertTransactionLocal(
      db,
      mirror({ id: 'inst-1', occurred_at: '2026-10-20T00:00:00.000Z' })
    );
    await updateLocalTransaction('user-a', 'inst-1', editInput, options);
    const edited = await listOpenOutbox(db, 'user-a');
    assert.equal(edited.length, 1);
    assert.equal(edited[0].entity, 'transaction');
    assert.equal(edited[0].entity_id, 'inst-1');
    assert.equal(edited[0].op, 'update');
    assert.equal(
      JSON.parse(edited[0].payload_json).recurring_series_id,
      'series-1'
    );

    await upsertTransactionLocal(
      db,
      mirror({ id: 'inst-2', occurred_at: '2026-10-21T00:00:00.000Z' })
    );
    await softDeleteLocalTransaction('user-a', 'inst-2', options);
    const deleted = await listOpenOutbox(db, 'user-a', 'inst-2');
    assert.equal(deleted.length, 1);
    assert.equal(deleted[0].op, 'soft_delete');
    assert.equal(deleted[0].entity_id, 'inst-2');
  });

  it('rejects a series row in the outbox', async () => {
    const db = await freshDb();
    await assert.rejects(
      db.run(
        `INSERT INTO outbox (
          id, user_id, entity, entity_id, op, payload_json, base_updated_at,
          created_at, attempts, last_error, status
        ) VALUES (?, ?, 'recurring_series', ?, 'create', '{}', NULL, ?, 0, NULL, 'pending')`,
        ['ob-series', 'user-a', 'series-1', '2026-10-27T12:00:00.000Z']
      )
    );
  });

  it('blocks a series change when the phone is offline', async () => {
    let called = false;
    await assert.rejects(
      () =>
        refuseOfflineSeriesChange(async () => {
          called = true;
          return false;
        }),
      /Connect to the internet to set up repeating transactions/
    );
    assert.equal(called, true);
    await refuseOfflineSeriesChange(async () => true);
    assert.equal(seriesChangeBlocked(true, false), true);
    assert.equal(seriesChangeBlocked(true, true), false);
    assert.equal(seriesChangeBlocked(false, false), false);
  });
});

describe('wipe, restore, and convert', () => {
  it('clears the mirror, outbox, and category cache', async () => {
    const db = await freshDb();
    await createLocalTransaction(
      'user-a',
      editInput,
      'HKD',
      repoOptions(db)
    );
    await saveCategoryCache(
      db,
      'user-a',
      [{ id: 'c1', name: 'Pets', type: 'expense' }],
      '2026-10-27T12:00:00.000Z'
    );
    await clearOfflineUserData(db, 'user-a');
    assert.equal((await listActiveTransactionsLocal(db, 'user-a')).length, 0);
    assert.equal((await listOpenOutbox(db, 'user-a')).length, 0);
    assert.equal(await readCategoryCache(db, 'user-a'), null);
  });

  it('clears a synced mirror when the outbox is already empty', async () => {
    const db = await freshDb();
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'synced',
        occurred_at: '2026-10-20T00:00:00.000Z',
        recurring_series_id: null,
        occurrence_key: null,
      })
    );
    assert.equal((await listOpenOutbox(db, 'user-a')).length, 0);
    assert.equal(wipeDiscardNotice(false), null);
    await clearOfflineUserData(db, 'user-a');
    assert.equal((await listActiveTransactionsLocal(db, 'user-a')).length, 0);
  });

  it('asks to discard unsynced changes only when the outbox is open', () => {
    assert.equal(wipeDiscardNotice(true), UNSYNCED_DISCARD_COPY);
    assert.equal(wipeDiscardNotice(false), null);
  });

  it('full-pulls from epoch after a local reset', async () => {
    const db = await freshDb();
    await createLocalTransaction('user-a', editInput, 'HKD', repoOptions(db));
    let since = '';
    const remote = stubRemote({
      async listTransactionsSince(value) {
        since = value;
        return [
          {
            id: 'restored',
            user_id: 'user-a',
            amount: 8,
            type: 'income',
            category: 'Salary',
            note: null,
            currency: 'HKD',
            occurred_at: '2026-10-02T00:00:00.000Z',
            recurring_series_id: null,
            occurrence_key: null,
            deleted_at: null,
            created_at: '2026-10-02T00:00:00.000Z',
            updated_at: '2026-10-02T00:00:00.000Z',
          },
        ];
      },
    });
    const pulled = await resetLocalAndFullPull('user-a', {
      db,
      remote,
      now: () => '2026-10-27T12:00:00.000Z',
    });
    assert.equal(since, FULL_PULL_SINCE);
    assert.equal(pulled.applied, 1);
    const rows = await listActiveTransactionsLocal(db, 'user-a');
    assert.deepEqual(
      rows.map((row) => row.id),
      ['restored']
    );
    assert.equal((await listOpenOutbox(db, 'user-a')).length, 0);
  });

  it('keeps a failed outbox when a series resync cannot push', async () => {
    const db = await freshDb();
    const created = await createLocalTransaction(
      'user-a',
      editInput,
      'HKD',
      repoOptions(db)
    );
    const outcome = await resyncAfterSeriesHardDelete('user-a', {
      db,
      remote: stubRemote({
        async createTransaction() {
          throw new Error('still offline');
        },
      }),
      now: () => '2026-10-27T12:00:00.000Z',
    });
    assert.equal(outcome, 'kept');
    const open = await listOpenOutbox(db, 'user-a');
    assert.equal(open.length, 1);
    assert.equal(open[0].entity_id, created.id);
    assert.equal(open[0].status, 'failed');
  });

  it('blocks convert while the outbox is open and asks to sync first', () => {
    assert.equal(SYNC_BEFORE_CONVERT_COPY, 'Sync pending changes first.');
    assert.equal(
      currencyConvertHint({
        enabled: false,
        online: true,
        outboxPending: true,
      }),
      null
    );
    assert.equal(
      currencyConvertHint({
        enabled: true,
        online: false,
        outboxPending: false,
      }),
      NEEDS_INTERNET_COPY
    );
    assert.equal(
      currencyConvertHint({
        enabled: true,
        online: true,
        outboxPending: true,
      }),
      SYNC_BEFORE_CONVERT_COPY
    );
    assert.equal(
      currencyConvertHint({
        enabled: true,
        online: true,
        outboxPending: false,
      }),
      null
    );
  });
});

describe('custom categories', () => {
  it('uses the last saved list when a refresh fails', async () => {
    const db = await freshDb();
    const saved = [{ id: 'c1', type: 'expense', name: 'Pets' }];
    await saveCategoryCache(db, 'user-a', saved, '2026-10-27T12:00:00.000Z');
    const offline = await loadCachedOrFreshCategories(
      db,
      'user-a',
      async () => {
        throw new Error('network down');
      },
      '2026-10-27T13:00:00.000Z'
    );
    assert.deepEqual(offline, saved);

    const fresh = await loadCachedOrFreshCategories(
      db,
      'user-a',
      async () => [{ id: 'c2', type: 'income', name: 'Bonus' }],
      '2026-10-27T14:00:00.000Z'
    );
    assert.equal(fresh[0].name, 'Bonus');
    const stored = await readCategoryCache<typeof fresh>(db, 'user-a');
    assert.equal(stored?.[0].name, 'Bonus');
  });

  it('marks an invalid category push failed and points at a fix', async () => {
    const db = await freshDb();
    const created = await createLocalTransaction(
      'user-a',
      { ...editInput, category: 'Pets' },
      'HKD',
      repoOptions(db)
    );
    const message = 'Category "Pets" is not allowed for expense';
    await pushOutbox(
      db,
      'user-a',
      stubRemote({
        async createTransaction() {
          throw new Error(message);
        },
      })
    );
    const open = await listOpenOutbox(db, 'user-a');
    assert.equal(open.length, 1);
    assert.equal(open[0].status, 'failed');
    assert.equal(open[0].entity_id, created.id);
    assert.equal(isInvalidCategoryError(open[0].last_error), true);
    const status = await readOfflineUxStatus(db, 'user-a');
    assert.deepEqual(status.categoryFixIds, [created.id]);
    assert.equal(
      offlineBannerCopy({
        enabled: true,
        online: true,
        openCount: status.openCount,
        lastSyncError: open[0].last_error,
      }),
      CATEGORY_FIX_COPY
    );
  });

  it('adds the category cache when upgrading a v1 database', async () => {
    const db = nodeSql(new DatabaseSync(':memory:'));
    await db.exec(OFFLINE_SCHEMA_V1_SQL);
    await db.exec('PRAGMA user_version = 1');
    await migrateOfflineSchema(db);
    await saveCategoryCache(db, 'user-a', [], '2026-10-27T12:00:00.000Z');
    assert.deepEqual(await readCategoryCache(db, 'user-a'), []);
  });
});
