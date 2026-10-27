/**
 * Phase 2: push-then-pull, LWW merge, and failed-push retry.
 * In-memory SQLite. The remote is a fake — no Supabase and no device.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import type { Transaction } from '../transactionModel.ts';
import { OFFLINE_TXNS_ENABLED } from './flag.ts';
import { listOpenOutbox } from './outbox.ts';
import {
  migrateOfflineSchema,
  type SqlExecutor,
  type SqlValue,
} from './schema.ts';
import {
  FULL_PULL_SINCE,
  clearOfflineUserData,
  pullRemote,
  readSyncMeta,
  remoteWinsLww,
  syncNow,
  type SyncRemote,
} from './syncEngine.ts';
import {
  createLocalTransaction,
  softDeleteLocalTransaction,
  updateLocalTransaction,
  type TransactionsRepoOptions,
} from './transactionsRepo.ts';
import {
  getTransactionLocal,
  getTransactionLocalAny,
  listActiveTransactionsLocal,
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

function repoOptions(
  db: SqlExecutor,
  now: string | (() => string) = '2026-10-27T12:00:00.000Z'
): TransactionsRepoOptions {
  let n = 0;
  return {
    db,
    now: typeof now === 'function' ? now : () => now,
    newId: () => `id-${++n}`,
  };
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

function asRemote(
  row: Pick<
    Transaction,
    | 'id'
    | 'user_id'
    | 'amount'
    | 'type'
    | 'category'
    | 'occurred_at'
    | 'created_at'
    | 'updated_at'
  > &
    Partial<Transaction>
): Transaction {
  return {
    note: null,
    currency: 'HKD',
    recurring_series_id: null,
    occurrence_key: null,
    deleted_at: null,
    ...row,
  };
}

function stubRemote(partial: Partial<SyncRemote>): SyncRemote {
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

describe('offline sync flag', () => {
  it('stays off so production still uses Supabase', () => {
    assert.equal(OFFLINE_TXNS_ENABLED, false);
  });
});

describe('sync ordering', () => {
  it('pushes the outbox before it pulls, and an empty cursor full-pulls from epoch', async () => {
    const db = await freshDb();
    const options = repoOptions(db);
    const first = await createLocalTransaction(
      'user-a',
      { amount: 3, type: 'expense', category: 'Groceries', occurred_at: '2026-10-27T08:00:00.000Z' },
      'HKD',
      options
    );
    const second = await createLocalTransaction(
      'user-a',
      { amount: 4, type: 'expense', category: 'Groceries', occurred_at: '2026-10-27T09:00:00.000Z' },
      'HKD',
      options
    );

    const calls: string[] = [];
    const remote = stubRemote({
      async createTransaction(row) {
        calls.push(`push:${row.id}`);
        return asRemote(row);
      },
      async listTransactionsSince(since) {
        calls.push(`pull:${since}`);
        return [];
      },
    });

    const result = await syncNow('user-a', {
      db,
      remote,
      isOnline: async () => true,
      now: () => '2026-10-27T13:00:00.000Z',
    });

    assert.deepEqual(calls, [
      `push:${first.id}`,
      `push:${second.id}`,
      `pull:${FULL_PULL_SINCE}`,
    ]);
    assert.equal(result.skipped, false);
    assert.equal(result.pushed, 2);
    assert.equal(result.failed, 0);
    assert.equal((await listOpenOutbox(db, 'user-a')).length, 0);
  });

  it('does not push or pull while offline', async () => {
    const db = await freshDb();
    const calls: string[] = [];
    const result = await syncNow('user-a', {
      db,
      isOnline: async () => false,
      remote: stubRemote({
        async listTransactionsSince() {
          calls.push('pull');
          return [];
        },
      }),
    });
    assert.equal(result.skipped, true);
    assert.deepEqual(calls, []);
  });

  it('still pulls after a failed push, and the next sync retries that row', async () => {
    const db = await freshDb();
    const options = repoOptions(db);
    const created = await createLocalTransaction(
      'user-a',
      { amount: 8, type: 'expense', category: 'Groceries', occurred_at: '2026-10-27T08:00:00.000Z' },
      'HKD',
      options
    );

    let attempts = 0;
    const calls: string[] = [];
    const remote = stubRemote({
      async createTransaction(row) {
        attempts += 1;
        calls.push('push');
        if (attempts < 3) throw new Error('network down');
        calls.push('push-ok');
        return asRemote(row);
      },
      async listTransactionsSince(since) {
        calls.push(`pull:${since}`);
        return [];
      },
    });
    const syncOptions = {
      db,
      remote,
      isOnline: async () => true,
      now: () => '2026-10-27T13:00:00.000Z',
    };

    const first = await syncNow('user-a', syncOptions);
    assert.equal(first.failed, 1);
    assert.equal(first.pushed, 0);
    assert.deepEqual(calls, ['push', `pull:${FULL_PULL_SINCE}`]);

    const queued = await listOpenOutbox(db, 'user-a', created.id);
    assert.equal(queued.length, 1);
    assert.equal(queued[0]?.status, 'failed');
    assert.equal(queued[0]?.attempts, 1);
    assert.match(queued[0]?.last_error ?? '', /network down/);
    const stillThere = await db.first<{ n: number }>(
      `SELECT COUNT(*) AS n FROM outbox WHERE entity_id = ?`,
      [created.id]
    );
    assert.equal(Number(stillThere?.n), 1);

    const second = await syncNow('user-a', syncOptions);
    assert.equal(second.failed, 1);
    const retried = await listOpenOutbox(db, 'user-a', created.id);
    assert.equal(retried.length, 1);
    assert.equal(retried[0]?.attempts, 2);
    assert.equal(retried[0]?.status, 'failed');

    const third = await syncNow('user-a', syncOptions);
    assert.equal(third.failed, 0);
    assert.equal(third.pushed, 1);
    assert.equal((await listOpenOutbox(db, 'user-a', created.id)).length, 0);
    const acked = await db.first<{ status: string; attempts: number }>(
      'SELECT status, attempts FROM outbox WHERE entity_id = ?',
      [created.id]
    );
    assert.equal(acked?.status, 'acked');
    assert.equal(Number(acked?.attempts), 2);
    const local = await getTransactionLocalAny(db, 'user-a', created.id);
    assert.equal(local?.pending_op, null);
  });

  it('a later edit coalesces onto a failed create instead of stacking a second row', async () => {
    const db = await freshDb();
    let tick = 0;
    const times = ['2026-10-27T12:00:00.000Z', '2026-10-27T12:05:00.000Z'];
    const options = repoOptions(
      db,
      () => times[Math.min(tick++, times.length - 1)] ?? times[1]
    );
    const created = await createLocalTransaction(
      'user-a',
      { amount: 8, type: 'expense', category: 'Groceries', occurred_at: '2026-10-27T08:00:00.000Z' },
      'HKD',
      options
    );
    await syncNow('user-a', {
      db,
      isOnline: async () => true,
      now: () => times[0],
      remote: stubRemote({
        async createTransaction() {
          throw new Error('network down');
        },
      }),
    });

    await updateLocalTransaction(
      'user-a',
      created.id,
      { amount: 21, type: 'expense', category: 'Groceries', occurred_at: '2026-10-27T08:00:00.000Z' },
      options
    );

    const open = await listOpenOutbox(db, 'user-a', created.id);
    assert.equal(open.length, 1);
    assert.equal(open[0]?.op, 'create');
    assert.equal(open[0]?.status, 'pending');
    const payload = JSON.parse(open[0]?.payload_json ?? '{}') as { amount: number };
    assert.equal(payload.amount, 21);
  });
});

describe('LWW merge', () => {
  it('treats a tie as remote, including equal instants in a different ISO form', () => {
    assert.equal(remoteWinsLww('2026-10-27T12:00:00.000Z', '2026-10-27T12:00:00.000Z'), true);
    assert.equal(remoteWinsLww('2026-10-27T12:00:00.000Z', '2026-10-27T12:00:00+00:00'), true);
    assert.equal(remoteWinsLww('2026-10-27T12:00:01.000Z', '2026-10-27T12:00:00.000Z'), false);
    assert.equal(remoteWinsLww(null, '2026-10-27T12:00:00.000Z'), true);
  });

  it('keeps a newer local row and its outbox', async () => {
    const db = await freshDb();
    const options = repoOptions(db, '2026-10-27T12:00:00.000Z');
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'txn-1',
        amount: 4,
        occurred_at: '2026-10-20T08:00:00.000Z',
        updated_at: '2026-10-20T08:00:00.000Z',
      })
    );
    const updated = await updateLocalTransaction(
      'user-a',
      'txn-1',
      { amount: 15, type: 'expense', category: 'Groceries', occurred_at: '2026-10-20T08:00:00.000Z' },
      options
    );
    assert.equal(updated.amount, 15);

    const remote = stubRemote({
      async listTransactionsSince(since) {
        assert.equal(since, FULL_PULL_SINCE);
        return [
          asRemote({
            id: 'txn-1',
            user_id: 'user-a',
            amount: 4,
            type: 'expense',
            category: 'Groceries',
            occurred_at: '2026-10-20T08:00:00.000Z',
            created_at: '2026-10-20T08:00:00.000Z',
            updated_at: '2026-10-21T08:00:00.000Z',
          }),
        ];
      },
    });

    const pulled = await pullRemote(db, 'user-a', remote, {
      now: () => '2026-10-27T13:00:00.000Z',
    });
    assert.equal(pulled.keptLocal, 1);
    assert.equal(pulled.applied, 0);
    assert.equal(pulled.lastPulledAt, '2026-10-21T08:00:00.000Z');

    const local = await getTransactionLocal(db, 'user-a', 'txn-1');
    assert.equal(local?.amount, 15);
    assert.equal(local?.pending_op, 'update');
    assert.equal((await listOpenOutbox(db, 'user-a', 'txn-1')).length, 1);
  });

  it('replaces the local row when remote is newer and drops the stale outbox', async () => {
    const db = await freshDb();
    const options = repoOptions(db, '2026-10-22T08:00:00.000Z');
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'txn-1',
        amount: 4,
        occurred_at: '2026-10-20T08:00:00.000Z',
        updated_at: '2026-10-20T08:00:00.000Z',
      })
    );
    await updateLocalTransaction(
      'user-a',
      'txn-1',
      { amount: 15, type: 'expense', category: 'Groceries', occurred_at: '2026-10-20T08:00:00.000Z' },
      options
    );

    await pullRemote(
      db,
      'user-a',
      stubRemote({
        async listTransactionsSince() {
          return [
            asRemote({
              id: 'txn-1',
              user_id: 'user-a',
              amount: 9,
              type: 'income',
              category: 'Salary',
              note: 'remote',
              occurred_at: '2026-10-20T08:00:00.000Z',
              created_at: '2026-10-20T08:00:00.000Z',
              updated_at: '2026-10-25T08:00:00.000Z',
            }),
          ];
        },
      }),
      { now: () => '2026-10-27T13:00:00.000Z' }
    );

    const local = await getTransactionLocal(db, 'user-a', 'txn-1');
    assert.equal(local?.amount, 9);
    assert.equal(local?.type, 'income');
    assert.equal(local?.note, 'remote');
    assert.equal(local?.pending_op, null);
    assert.equal((await listOpenOutbox(db, 'user-a', 'txn-1')).length, 0);
    assert.equal(
      (await readSyncMeta(db, 'user-a'))?.last_pulled_at,
      '2026-10-25T08:00:00.000Z'
    );
  });

  it('lets remote win when updated_at ties, including a tombstone', async () => {
    const db = await freshDb();
    const tie = '2026-10-27T12:00:00.000Z';
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'txn-1',
        amount: 4,
        occurred_at: '2026-10-20T08:00:00.000Z',
        updated_at: tie,
        pending_op: 'update',
      })
    );

    await pullRemote(
      db,
      'user-a',
      stubRemote({
        async listTransactionsSince() {
          return [
            asRemote({
              id: 'txn-1',
              user_id: 'user-a',
              amount: 30,
              type: 'expense',
              category: 'Groceries',
              occurred_at: '2026-10-20T08:00:00.000Z',
              created_at: '2026-10-20T08:00:00.000Z',
              updated_at: '2026-10-27T12:00:00+00:00',
              deleted_at: '2026-10-27T12:00:00.000Z',
            }),
            asRemote({
              id: 'other',
              user_id: 'user-b',
              amount: 99,
              type: 'expense',
              category: 'Groceries',
              occurred_at: '2026-10-20T08:00:00.000Z',
              created_at: '2026-10-20T08:00:00.000Z',
              updated_at: '2026-10-28T00:00:00.000Z',
            }),
          ];
        },
      }),
      { now: () => '2026-10-27T13:00:00.000Z' }
    );

    assert.equal(await getTransactionLocal(db, 'user-a', 'txn-1'), null);
    const tomb = await getTransactionLocalAny(db, 'user-a', 'txn-1');
    assert.equal(tomb?.amount, 30);
    assert.equal(tomb?.deleted_at, '2026-10-27T12:00:00.000Z');
    assert.equal(tomb?.pending_op, null);
    assert.equal(await getTransactionLocalAny(db, 'user-a', 'other'), null);
    assert.equal((await listActiveTransactionsLocal(db, 'user-a')).length, 0);
    assert.equal(
      (await readSyncMeta(db, 'user-a'))?.last_pulled_at,
      '2026-10-27T12:00:00+00:00'
    );
  });

  it('does not advance the cursor when the pull fails', async () => {
    const db = await freshDb();
    await db.run(
      `INSERT INTO sync_meta (user_id, last_pulled_at, last_sync_at, last_sync_error)
       VALUES ('user-a', '2026-10-20T00:00:00.000Z', NULL, NULL)`
    );
    await assert.rejects(
      () =>
        pullRemote(
          db,
          'user-a',
          stubRemote({
            async listTransactionsSince() {
              throw new Error('pull failed');
            },
          }),
          { now: () => '2026-10-27T13:00:00.000Z' }
        ),
      /pull failed/
    );
    const meta = await readSyncMeta(db, 'user-a');
    assert.equal(meta?.last_pulled_at, '2026-10-20T00:00:00.000Z');
    assert.match(meta?.last_sync_error ?? '', /pull failed/);
  });

  it('uses the advanced cursor on the next pull', async () => {
    const db = await freshDb();
    const seen: string[] = [];
    const remote = stubRemote({
      async listTransactionsSince(since) {
        seen.push(since);
        if (seen.length === 1) {
          return [
            asRemote({
              id: 'txn-1',
              user_id: 'user-a',
              amount: 2,
              type: 'expense',
              category: 'Groceries',
              occurred_at: '2026-10-20T08:00:00.000Z',
              created_at: '2026-10-20T08:00:00.000Z',
              updated_at: '2026-10-24T08:00:00.000Z',
            }),
          ];
        }
        return [];
      },
    });
    const options = {
      db,
      remote,
      isOnline: async () => true,
      now: () => '2026-10-27T13:00:00.000Z',
    };
    await syncNow('user-a', options);
    await syncNow('user-a', options);
    assert.deepEqual(seen, [FULL_PULL_SINCE, '2026-10-24T08:00:00.000Z']);
    const local = await getTransactionLocal(db, 'user-a', 'txn-1');
    assert.equal(local?.amount, 2);
    assert.equal(local?.pending_op, null);
  });
});

describe('push conflicts and sign-out', () => {
  it('drops a pending update when the remote row is newer', async () => {
    const db = await freshDb();
    const options = repoOptions(db, '2026-10-22T08:00:00.000Z');
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'txn-1',
        amount: 4,
        occurred_at: '2026-10-20T08:00:00.000Z',
        updated_at: '2026-10-20T08:00:00.000Z',
      })
    );
    await updateLocalTransaction(
      'user-a',
      'txn-1',
      { amount: 15, type: 'expense', category: 'Groceries', occurred_at: '2026-10-20T08:00:00.000Z' },
      options
    );

    const bases: Array<string | null> = [];
    await syncNow('user-a', {
      db,
      isOnline: async () => true,
      now: () => '2026-10-27T13:00:00.000Z',
      remote: stubRemote({
        async updateTransaction(_row, baseUpdatedAt) {
          bases.push(baseUpdatedAt);
          return null;
        },
        async getTransaction() {
          return asRemote({
            id: 'txn-1',
            user_id: 'user-a',
            amount: 50,
            type: 'expense',
            category: 'Groceries',
            occurred_at: '2026-10-20T08:00:00.000Z',
            created_at: '2026-10-20T08:00:00.000Z',
            updated_at: '2026-10-26T08:00:00.000Z',
          });
        },
      }),
    });

    assert.deepEqual(bases, ['2026-10-20T08:00:00.000Z']);
    const local = await getTransactionLocal(db, 'user-a', 'txn-1');
    assert.equal(local?.amount, 50);
    assert.equal((await listOpenOutbox(db, 'user-a', 'txn-1')).length, 0);
  });

  it('force-pushes when the local edit is newer than the remote row', async () => {
    const db = await freshDb();
    const options = repoOptions(db, '2026-10-26T08:00:00.000Z');
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'txn-1',
        amount: 4,
        occurred_at: '2026-10-20T08:00:00.000Z',
        updated_at: '2026-10-20T08:00:00.000Z',
      })
    );
    await updateLocalTransaction(
      'user-a',
      'txn-1',
      { amount: 15, type: 'expense', category: 'Groceries', occurred_at: '2026-10-20T08:00:00.000Z' },
      options
    );

    const bases: Array<string | null> = [];
    await syncNow('user-a', {
      db,
      isOnline: async () => true,
      now: () => '2026-10-27T13:00:00.000Z',
      remote: stubRemote({
        async updateTransaction(row, baseUpdatedAt) {
          bases.push(baseUpdatedAt);
          if (baseUpdatedAt) return null;
          return asRemote({
            ...row,
            amount: row.amount,
            updated_at: '2026-10-26T08:00:01.000Z',
          });
        },
        async getTransaction() {
          return asRemote({
            id: 'txn-1',
            user_id: 'user-a',
            amount: 4,
            type: 'expense',
            category: 'Groceries',
            occurred_at: '2026-10-20T08:00:00.000Z',
            created_at: '2026-10-20T08:00:00.000Z',
            updated_at: '2026-10-21T08:00:00.000Z',
          });
        },
      }),
    });

    assert.deepEqual(bases, ['2026-10-20T08:00:00.000Z', null]);
    const local = await getTransactionLocalAny(db, 'user-a', 'txn-1');
    assert.equal(local?.amount, 15);
    assert.equal(local?.pending_op, null);
    assert.equal(local?.updated_at, '2026-10-26T08:00:01.000Z');
    assert.equal((await listOpenOutbox(db, 'user-a', 'txn-1')).length, 0);
  });

  it('acks a create that hits a unique conflict instead of dropping it', async () => {
    const db = await freshDb();
    const options = repoOptions(db);
    const created = await createLocalTransaction(
      'user-a',
      { amount: 6, type: 'expense', category: 'Groceries', occurred_at: '2026-10-27T08:00:00.000Z' },
      'HKD',
      options
    );
    await syncNow('user-a', {
      db,
      isOnline: async () => true,
      remote: stubRemote({
        async createTransaction() {
          const error = new Error('duplicate key value violates unique constraint') as Error & {
            code?: string;
          };
          error.code = '23505';
          throw error;
        },
      }),
    });
    const row = await db.first<{ status: string }>(
      'SELECT status FROM outbox WHERE entity_id = ?',
      [created.id]
    );
    assert.equal(row?.status, 'acked');
    assert.equal((await listOpenOutbox(db, 'user-a', created.id)).length, 0);
  });

  it('pushes a soft-delete and pulls a tombstone into the mirror', async () => {
    const db = await freshDb();
    const options = repoOptions(db, '2026-10-27T12:00:00.000Z');
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'txn-1',
        amount: 4,
        occurred_at: '2026-10-20T08:00:00.000Z',
        updated_at: '2026-10-20T08:00:00.000Z',
      })
    );
    await softDeleteLocalTransaction('user-a', 'txn-1', options);

    const deleted: string[] = [];
    await syncNow('user-a', {
      db,
      isOnline: async () => true,
      now: () => '2026-10-27T13:00:00.000Z',
      remote: stubRemote({
        async softDeleteTransaction(id, deletedAt) {
          deleted.push(`${id}:${deletedAt}`);
          return true;
        },
        async listTransactionsSince() {
          return [
            asRemote({
              id: 'txn-1',
              user_id: 'user-a',
              amount: 4,
              type: 'expense',
              category: 'Groceries',
              occurred_at: '2026-10-20T08:00:00.000Z',
              created_at: '2026-10-20T08:00:00.000Z',
              updated_at: '2026-10-27T12:00:01.000Z',
              deleted_at: '2026-10-27T12:00:00.000Z',
            }),
          ];
        },
      }),
    });

    assert.deepEqual(deleted, ['txn-1:2026-10-27T12:00:00.000Z']);
    assert.equal(await getTransactionLocal(db, 'user-a', 'txn-1'), null);
    assert.equal(
      (await getTransactionLocalAny(db, 'user-a', 'txn-1'))?.deleted_at,
      '2026-10-27T12:00:00.000Z'
    );
    assert.equal((await listOpenOutbox(db, 'user-a')).length, 0);
  });

  it('sign-out clears sqlite and the outbox for that user only', async () => {
    const db = await freshDb();
    const options = repoOptions(db);
    await createLocalTransaction(
      'user-a',
      { amount: 5, type: 'expense', category: 'Groceries', occurred_at: '2026-10-27T08:00:00.000Z' },
      'HKD',
      options
    );
    await upsertTransactionLocal(
      db,
      mirror({
        id: 'b-row',
        user_id: 'user-b',
        occurred_at: '2026-10-27T08:00:00.000Z',
      })
    );
    await db.run(
      `INSERT INTO sync_meta (user_id, last_pulled_at, last_sync_at, last_sync_error)
       VALUES ('user-a', '2026-10-01T00:00:00.000Z', NULL, NULL),
              ('user-b', '2026-10-02T00:00:00.000Z', NULL, NULL)`
    );

    await clearOfflineUserData(db, 'user-a');

    assert.equal((await listActiveTransactionsLocal(db, 'user-a')).length, 0);
    assert.equal((await listOpenOutbox(db, 'user-a')).length, 0);
    assert.equal(await readSyncMeta(db, 'user-a'), null);
    assert.equal((await listActiveTransactionsLocal(db, 'user-b')).length, 1);
    assert.equal(
      (await readSyncMeta(db, 'user-b'))?.last_pulled_at,
      '2026-10-02T00:00:00.000Z'
    );
  });
});
