/**
 * CRUD for the SQLite mirror of the signed-in user's transactions.
 * Does not talk to Supabase. Tombstones stay in the table for a later sync.
 */
import type { Transaction } from '@/lib/transactionModel';

import type { SqlExecutor, SqlValue } from './schema';
import type { PendingOp, TransactionLocalRow } from './types';

const UPSERT_SQL = `
INSERT INTO transactions_local (
  id, user_id, amount, type, category, note, currency, occurred_at,
  recurring_series_id, occurrence_key, deleted_at, created_at, updated_at,
  pending_op
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  user_id = excluded.user_id,
  amount = excluded.amount,
  type = excluded.type,
  category = excluded.category,
  note = excluded.note,
  currency = excluded.currency,
  occurred_at = excluded.occurred_at,
  recurring_series_id = excluded.recurring_series_id,
  occurrence_key = excluded.occurrence_key,
  deleted_at = excluded.deleted_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  pending_op = excluded.pending_op
`;

export function toTransaction(row: TransactionLocalRow): Transaction {
  return {
    id: row.id,
    user_id: row.user_id,
    amount: row.amount,
    type: row.type,
    category: row.category,
    note: row.note,
    currency: row.currency,
    occurred_at: row.occurred_at,
    recurring_series_id: row.recurring_series_id,
    occurrence_key: row.occurrence_key,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function upsertTransactionLocal(
  db: SqlExecutor,
  row: TransactionLocalRow
): Promise<void> {
  await db.run(UPSERT_SQL, rowParams(row));
}

/** Active rows for one user, newest occurred_at first (then created_at). */
export async function listActiveTransactionsLocal(
  db: SqlExecutor,
  userId: string
): Promise<TransactionLocalRow[]> {
  const rows = await db.all<Record<string, unknown>>(
    `SELECT * FROM transactions_local
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY occurred_at DESC, created_at DESC`,
    [userId]
  );
  return rows.map(mapLocalRow);
}

/** Active row only. Soft-deleted ids return null, matching remote get. */
export async function getTransactionLocal(
  db: SqlExecutor,
  userId: string,
  id: string
): Promise<TransactionLocalRow | null> {
  const row = await db.first<Record<string, unknown>>(
    `SELECT * FROM transactions_local
     WHERE user_id = ? AND id = ? AND deleted_at IS NULL`,
    [userId, id]
  );
  return row ? mapLocalRow(row) : null;
}

/**
 * Soft-delete one active row. Sets deleted_at, bumps updated_at, and marks
 * pending_op = 'delete'. Returns false when no active row matched.
 */
export async function softDeleteTransactionLocal(
  db: SqlExecutor,
  userId: string,
  id: string,
  deletedAt: string
): Promise<boolean> {
  await db.run(
    `UPDATE transactions_local
     SET deleted_at = ?, updated_at = ?, pending_op = 'delete'
     WHERE user_id = ? AND id = ? AND deleted_at IS NULL`,
    [deletedAt, deletedAt, userId, id]
  );
  const changed = await db.first<{ n: number }>('SELECT changes() AS n');
  return Number(changed?.n ?? 0) > 0;
}

/** Drop a never-synced local row. Does not touch the outbox. */
export async function removeTransactionLocal(
  db: SqlExecutor,
  userId: string,
  id: string
): Promise<void> {
  await db.run(
    'DELETE FROM transactions_local WHERE user_id = ? AND id = ?',
    [userId, id]
  );
}

function rowParams(row: TransactionLocalRow): SqlValue[] {
  return [
    row.id,
    row.user_id,
    row.amount,
    row.type,
    row.category,
    row.note,
    row.currency,
    row.occurred_at,
    row.recurring_series_id,
    row.occurrence_key,
    row.deleted_at,
    row.created_at,
    row.updated_at,
    row.pending_op,
  ];
}

function mapLocalRow(row: Record<string, unknown>): TransactionLocalRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    amount: Number(row.amount),
    type: asType(row.type),
    category: String(row.category),
    note: row.note == null ? null : String(row.note),
    currency: String(row.currency),
    occurred_at: String(row.occurred_at),
    recurring_series_id:
      row.recurring_series_id == null ? null : String(row.recurring_series_id),
    occurrence_key: row.occurrence_key == null ? null : String(row.occurrence_key),
    deleted_at: row.deleted_at == null ? null : String(row.deleted_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    pending_op: asPending(row.pending_op),
  };
}

function asType(value: unknown): 'expense' | 'income' {
  if (value === 'expense' || value === 'income') return value;
  throw new Error('Invalid transaction type.');
}

function asPending(value: unknown): PendingOp | null {
  if (value == null) return null;
  if (value === 'create' || value === 'update' || value === 'delete') return value;
  throw new Error('Invalid pending_op.');
}
