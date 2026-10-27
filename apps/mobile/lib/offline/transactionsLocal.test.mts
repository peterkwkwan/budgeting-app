/**
 * Phase 1: local upsert, soft-delete, and list visibility on an in-memory
 * SQLite fixture (Node's node:sqlite). No device and no Supabase.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  filterTransactionsVisible,
  type TransactionInput,
} from '../transactionModel.ts';
import { listPendingOutbox } from './outbox.ts';
import {
  migrateOfflineSchema,
  readUserVersion,
  type SqlExecutor,
  type SqlValue,
} from './schema.ts';
import {
  createLocalTransaction,
  getLocalTransaction,
  listLocalTransactions,
  softDeleteLocalTransaction,
  updateLocalTransaction,
  type TransactionsRepoOptions,
} from './transactionsRepo.ts';
import {
  getTransactionLocal,
  listActiveTransactionsLocal,
  softDeleteTransactionLocal,
  toTransaction,
  upsertTransactionLocal,
} from './transactionsLocal.ts';
import type { TransactionLocalRow } from './types.ts';

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

function mirror(
  partial: Partial<TransactionLocalRow> &
    Pick<TransactionLocalRow, 'id' | 'occurred_at'>
): TransactionLocalRow {
  return {
    user_id: 'user-a',
    amount: 10,
    type: 'expense',
    category: 'Groceries',
    note: null,
    currency: 'HKD',
    recurring_series_id: null,
    occurrence_key: null,
    deleted_at: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    pending_op: null,
    ...partial,
  };
}

const NOW = new Date('2026-10-27T12:00:00.000Z');

function input(
  partial: Partial<TransactionInput> & Pick<TransactionInput, 'amount'>
): TransactionInput {
  return {
    type: 'expense',
    category: 'Groceries',
    occurred_at: '2026-10-27T12:00:00.000Z',
    ...partial,
  };
}

describe('offline schema', () => {
  it('creates the local tables and is idempotent', async () => {
    const db = await freshDb();
    assert.equal(await readUserVersion(db), 2);

    const tables = await db.all<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    );
    assert.deepEqual(
      tables.map((table) => table.name),
      ['category_cache', 'outbox', 'sync_meta', 'transactions_local']
    );

    await db.run(
      `INSERT INTO sync_meta (user_id, last_pulled_at, last_sync_at, last_sync_error)
       VALUES ('user-a', NULL, NULL, NULL)`
    );
    await migrateOfflineSchema(db);
    const meta = await db.first<{ user_id: string }>(
      'SELECT user_id FROM sync_meta WHERE user_id = ?',
      ['user-a']
    );
    assert.equal(meta?.user_id, 'user-a');
    assert.equal(await readUserVersion(db), 2);
  });
});

describe('transactions local mirror', () => {
  it('upserts, replaces on the same id, and lists active rows for that user', async () => {
    const db = await freshDb();
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'older',
        amount: 4,
        occurred_at: '2026-10-20T08:00:00.000Z',
        created_at: '2026-10-20T08:00:00.000Z',
      })
    );
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'newer',
        amount: 12.5,
        note: 'coffee',
        occurred_at: '2026-10-26T08:00:00.000Z',
        created_at: '2026-10-26T08:00:00.000Z',
      })
    );
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'newer',
        amount: 15,
        note: 'coffee',
        occurred_at: '2026-10-26T08:00:00.000Z',
        created_at: '2026-10-26T08:00:00.000Z',
        updated_at: '2026-10-26T09:00:00.000Z',
      })
    );
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'other-user',
        user_id: 'user-b',
        occurred_at: '2026-10-27T08:00:00.000Z',
      })
    );

    const listed = await listActiveTransactionsLocal(db, 'user-a');
    assert.deepEqual(
      listed.map((row) => row.id),
      ['newer', 'older']
    );
    assert.equal(listed[0]?.amount, 15);
    assert.equal(listed[0]?.note, 'coffee');

    const got = await getTransactionLocal(db, 'user-a', 'newer');
    assert.equal(got?.amount, 15);
    assert.equal(await getTransactionLocal(db, 'user-b', 'newer'), null);
    assert.equal((await listActiveTransactionsLocal(db, 'user-b')).length, 1);
  });

  it('soft-delete hides the row from list and get and keeps a tombstone', async () => {
    const db = await freshDb();
    const deletedAt = '2026-10-27T13:00:00.000Z';
    await upsertTransactionLocal(
      db,
      mirror({ id: 'keep', occurred_at: '2026-10-27T08:00:00.000Z' })
    );
    await upsertTransactionLocal(
      db,
      mirror({ id: 'gone', occurred_at: '2026-10-26T08:00:00.000Z' })
    );

    assert.equal(
      await softDeleteTransactionLocal(db, 'user-b', 'gone', deletedAt),
      false
    );
    assert.equal(
      await softDeleteTransactionLocal(db, 'user-a', 'gone', deletedAt),
      true
    );
    assert.equal(
      await softDeleteTransactionLocal(db, 'user-a', 'gone', deletedAt),
      false
    );

    const listed = await listActiveTransactionsLocal(db, 'user-a');
    assert.deepEqual(
      listed.map((row) => row.id),
      ['keep']
    );
    assert.equal(await getTransactionLocal(db, 'user-a', 'gone'), null);

    const tomb = await db.first<{
      deleted_at: string | null;
      pending_op: string | null;
      updated_at: string;
    }>(
      'SELECT deleted_at, pending_op, updated_at FROM transactions_local WHERE id = ?',
      ['gone']
    );
    assert.equal(tomb?.deleted_at, deletedAt);
    assert.equal(tomb?.updated_at, deletedAt);
    assert.equal(tomb?.pending_op, 'delete');
  });

  it('list visibility keeps one-offs, hides future recurring, and omits soft-deletes', async () => {
    const db = await freshDb();
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'one-off-future',
        occurred_at: '2026-11-02T12:00:00.000Z',
      })
    );
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'repeat-past',
        occurred_at: '2026-10-26T12:00:00.000Z',
        recurring_series_id: 'series-1',
        occurrence_key: '2026-10-26',
      })
    );
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'repeat-today',
        occurred_at: '2026-10-27T08:00:00.000Z',
        recurring_series_id: 'series-1',
        occurrence_key: '2026-10-27',
      })
    );
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'repeat-future',
        occurred_at: '2026-10-28T12:00:00.000Z',
        recurring_series_id: 'series-1',
        occurrence_key: '2026-10-28',
      })
    );
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'deleted-one-off',
        occurred_at: '2026-10-25T12:00:00.000Z',
      })
    );
    await softDeleteTransactionLocal(
      db,
      'user-a',
      'deleted-one-off',
      '2026-10-27T13:00:00.000Z'
    );

    const active = await listActiveTransactionsLocal(db, 'user-a');
    assert.equal(
      active.some((row) => row.id === 'deleted-one-off'),
      false
    );

    const visible = filterTransactionsVisible(
      active.map(toTransaction),
      'UTC',
      NOW
    );
    assert.deepEqual(
      visible.map((row) => row.id).sort(),
      ['one-off-future', 'repeat-past', 'repeat-today']
    );
  });
});

describe('transactions repo outbox writes', () => {
  function optionsFor(db: SqlExecutor): TransactionsRepoOptions {
    let n = 0;
    return {
      db,
      now: () => '2026-10-27T12:00:00.000Z',
      newId: () => `id-${++n}`,
    };
  }

  it('create writes the mirror and one pending outbox create', async () => {
    const db = await freshDb();
    const options = optionsFor(db);
    const created = await createLocalTransaction(
      'user-a',
      input({ amount: 18, note: '  lunch  ' }),
      'HKD',
      options
    );

    assert.equal(created.id, 'id-1');
    assert.equal(created.note, 'lunch');
    assert.equal(created.category, 'Groceries');

    const listed = await listLocalTransactions('user-a', options);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.amount, 18);

    const pending = await listPendingOutbox(db, 'user-a', created.id);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.op, 'create');
    assert.equal(pending[0]?.status, 'pending');
    assert.equal(pending[0]?.base_updated_at, null);
    const payload = JSON.parse(pending[0]?.payload_json ?? '{}') as {
      amount: number;
      pending_op: string;
    };
    assert.equal(payload.amount, 18);
    assert.equal(payload.pending_op, 'create');
  });

  it('edit after create coalesces onto the pending create', async () => {
    const db = await freshDb();
    let tick = 0;
    const times = ['2026-10-27T12:00:00.000Z', '2026-10-27T12:05:00.000Z'];
    const options: TransactionsRepoOptions = {
      db,
      now: () => times[Math.min(tick++, times.length - 1)] ?? times[0],
      newId: (() => {
        let n = 0;
        return () => `id-${++n}`;
      })(),
    };

    const created = await createLocalTransaction(
      'user-a',
      input({ amount: 10 }),
      'HKD',
      options
    );
    const updated = await updateLocalTransaction(
      'user-a',
      created.id,
      input({ amount: 25, note: 'edited' }),
      options
    );

    assert.equal(updated.amount, 25);
    const pending = await listPendingOutbox(db, 'user-a', created.id);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.op, 'create');
    const payload = JSON.parse(pending[0]?.payload_json ?? '{}') as {
      amount: number;
      pending_op: string;
    };
    assert.equal(payload.amount, 25);
    assert.equal(payload.pending_op, 'create');

    const stored = await getTransactionLocal(db, 'user-a', created.id);
    assert.equal(stored?.pending_op, 'create');
    assert.equal(stored?.updated_at, '2026-10-27T12:05:00.000Z');
  });

  it('soft-delete before push drops the create and the local row', async () => {
    const db = await freshDb();
    const options = optionsFor(db);
    const created = await createLocalTransaction(
      'user-a',
      input({ amount: 9 }),
      'HKD',
      options
    );
    await softDeleteLocalTransaction('user-a', created.id, options);

    assert.equal((await listLocalTransactions('user-a', options)).length, 0);
    assert.equal(await getLocalTransaction('user-a', created.id, options), null);
    assert.equal((await listPendingOutbox(db, 'user-a', created.id)).length, 0);
    const left = await db.first<{ n: number }>(
      'SELECT COUNT(*) AS n FROM transactions_local WHERE id = ?',
      [created.id]
    );
    assert.equal(Number(left?.n), 0);
  });

  it('soft-delete of a synced row keeps a tombstone and enqueues soft_delete', async () => {
    const db = await freshDb();
    const options = optionsFor(db);
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'synced',
        amount: 40,
        occurred_at: '2026-10-20T08:00:00.000Z',
        updated_at: '2026-10-20T08:00:00.000Z',
        pending_op: null,
      })
    );

    await softDeleteLocalTransaction('user-a', 'synced', options);

    assert.equal(await getLocalTransaction('user-a', 'synced', options), null);
    const pending = await listPendingOutbox(db, 'user-a', 'synced');
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.op, 'soft_delete');
    assert.equal(pending[0]?.base_updated_at, '2026-10-20T08:00:00.000Z');
    assert.deepEqual(JSON.parse(pending[0]?.payload_json ?? '{}'), {
      id: 'synced',
      deleted_at: '2026-10-27T12:00:00.000Z',
    });

    const tomb = await db.first<{ deleted_at: string; pending_op: string }>(
      'SELECT deleted_at, pending_op FROM transactions_local WHERE id = ?',
      ['synced']
    );
    assert.equal(tomb?.deleted_at, '2026-10-27T12:00:00.000Z');
    assert.equal(tomb?.pending_op, 'delete');
  });

  it('rejects an invalid amount without writing', async () => {
    const db = await freshDb();
    const options = optionsFor(db);
    await assert.rejects(
      () =>
        createLocalTransaction(
          'user-a',
          input({ amount: 0 }),
          'HKD',
          options
        ),
      /greater than zero/
    );
    assert.equal((await listLocalTransactions('user-a', options)).length, 0);
    assert.equal((await listPendingOutbox(db, 'user-a')).length, 0);
  });
});
