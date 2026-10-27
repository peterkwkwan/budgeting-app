/**
 * Local transaction repository: SQLite mirror + outbox.
 * Does not call Supabase. Hooks use this only when OFFLINE_TXNS_ENABLED.
 * A recurring instance edit or soft-delete is a normal outbox op on that txn id.
 * Series create, edit-future, and stop are not queued here.
 */
import { DEFAULT_CURRENCY } from '@/constants/currencies';
import {
  inputFromBulkPatch,
  validateTransactionInput,
  type Transaction,
  type TransactionBulkPatch,
  type TransactionInput,
} from '@/lib/transactionModel';

import { withSqlTransaction, type SqlExecutor } from './schema';
import {
  deletePendingOutbox,
  enqueueTransactionChange,
  listPendingOutbox,
} from './outbox';
import {
  getTransactionLocal,
  listActiveTransactionsLocal,
  removeTransactionLocal,
  softDeleteTransactionLocal,
  toTransaction,
  upsertTransactionLocal,
} from './transactionsLocal';
import type { TransactionLocalRow } from './types';

export type TransactionsRepoOptions = {
  /** Injected driver. Production uses the on-device database. */
  db?: SqlExecutor;
  now?: () => string;
  newId?: () => string;
};

export async function listLocalTransactions(
  userId: string,
  options?: TransactionsRepoOptions
): Promise<Transaction[]> {
  const db = await resolveDb(options);
  const rows = await listActiveTransactionsLocal(db, userId);
  return rows.map(toTransaction);
}

export async function getLocalTransaction(
  userId: string,
  id: string,
  options?: TransactionsRepoOptions
): Promise<Transaction | null> {
  const db = await resolveDb(options);
  const row = await getTransactionLocal(db, userId, id);
  return row ? toTransaction(row) : null;
}

export async function createLocalTransaction(
  userId: string,
  input: TransactionInput,
  currency: string = DEFAULT_CURRENCY,
  options?: TransactionsRepoOptions
): Promise<Transaction> {
  const validationError = validateTransactionInput(input);
  if (validationError) throw new Error(validationError);

  const db = await resolveDb(options);
  const now = timestamp(options);
  const id = await nextId(options);
  const outboxId = await nextId(options);
  const note = input.note?.trim() ? input.note.trim() : null;
  const row: TransactionLocalRow = {
    id,
    user_id: userId,
    amount: input.amount,
    type: input.type,
    category: input.category.trim(),
    note,
    currency,
    occurred_at: input.occurred_at,
    recurring_series_id: null,
    occurrence_key: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    pending_op: 'create',
  };

  await withSqlTransaction(db, async () => {
    await upsertTransactionLocal(db, row);
    await enqueueTransactionChange(db, {
      userId,
      entityId: id,
      op: 'create',
      payload: row,
      baseUpdatedAt: null,
      now,
      outboxId,
    });
  });

  return toTransaction(row);
}

export async function updateLocalTransaction(
  userId: string,
  id: string,
  input: TransactionInput,
  options?: TransactionsRepoOptions
): Promise<Transaction> {
  const validationError = validateTransactionInput(input);
  if (validationError) throw new Error(validationError);

  const db = await resolveDb(options);
  const now = timestamp(options);
  const outboxId = await nextId(options);
  let saved: TransactionLocalRow | null = null;

  await withSqlTransaction(db, async () => {
    const existing = await getTransactionLocal(db, userId, id);
    if (!existing) throw new Error('Transaction not found.');
    const note = input.note?.trim() ? input.note.trim() : null;
    const next: TransactionLocalRow = {
      ...existing,
      amount: input.amount,
      type: input.type,
      // Match remote update: store category as entered after validation.
      category: input.category,
      note,
      occurred_at: input.occurred_at,
      updated_at: now,
      pending_op: existing.pending_op === 'create' ? 'create' : 'update',
    };
    await upsertTransactionLocal(db, next);
    await enqueueTransactionChange(db, {
      userId,
      entityId: id,
      op: 'update',
      payload: next,
      baseUpdatedAt: existing.updated_at,
      now,
      outboxId,
    });
    saved = next;
  });

  if (!saved) throw new Error('Transaction not found.');
  return toTransaction(saved);
}

export async function softDeleteLocalTransaction(
  userId: string,
  id: string,
  options?: TransactionsRepoOptions
): Promise<void> {
  const db = await resolveDb(options);
  const now = timestamp(options);
  const outboxId = await nextId(options);

  await withSqlTransaction(db, async () => {
    const existing = await getTransactionLocal(db, userId, id);
    if (!existing) return;

    const pending = await listPendingOutbox(db, userId, id);
    const neverSynced =
      existing.pending_op === 'create' || pending.some((row) => row.op === 'create');
    if (neverSynced) {
      await deletePendingOutbox(db, userId, id);
      await removeTransactionLocal(db, userId, id);
      return;
    }

    await softDeleteTransactionLocal(db, userId, id, now);
    await enqueueTransactionChange(db, {
      userId,
      entityId: id,
      op: 'soft_delete',
      payload: { id, deleted_at: now },
      baseUpdatedAt: existing.updated_at,
      now,
      outboxId,
    });
  });
}

export async function softDeleteLocalTransactions(
  userId: string,
  ids: string[],
  options?: TransactionsRepoOptions
): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  for (const id of unique) {
    await softDeleteLocalTransaction(userId, id, options);
  }
}

export async function bulkPatchLocalTransactions(
  userId: string,
  rows: Transaction[],
  patch: TransactionBulkPatch,
  options?: TransactionsRepoOptions
): Promise<void> {
  if (rows.length === 0) return;
  if (
    patch.occurred_at === undefined &&
    patch.category === undefined &&
    patch.note === undefined
  ) {
    return;
  }
  for (const row of rows) {
    await updateLocalTransaction(
      userId,
      row.id,
      inputFromBulkPatch(row, patch),
      options
    );
  }
}

async function resolveDb(options?: TransactionsRepoOptions): Promise<SqlExecutor> {
  if (options?.db) return options.db;
  const { getOfflineDb } = await import('./db');
  return getOfflineDb();
}

function timestamp(options?: TransactionsRepoOptions): string {
  return options?.now?.() ?? new Date().toISOString();
}

async function nextId(options?: TransactionsRepoOptions): Promise<string> {
  if (options?.newId) return options.newId();
  const { newClientId } = await import('./ids');
  return newClientId();
}
