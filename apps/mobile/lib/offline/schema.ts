/**
 * On-device schema for transactions-only offline (plan §5).
 * Versioned with SQLite `user_version`. No Supabase migration.
 */

export const OFFLINE_SCHEMA_VERSION = 1;

export type SqlValue = string | number | null;

/** Small async SQL surface shared by expo-sqlite and the Node test driver. */
export type SqlExecutor = {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  all<Row>(sql: string, params?: readonly SqlValue[]): Promise<Row[]>;
  first<Row>(sql: string, params?: readonly SqlValue[]): Promise<Row | null>;
};

export const OFFLINE_SCHEMA_V1_SQL = `
CREATE TABLE IF NOT EXISTS transactions_local (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  category TEXT NOT NULL,
  note TEXT,
  currency TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  recurring_series_id TEXT,
  occurrence_key TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  pending_op TEXT CHECK (
    pending_op IS NULL OR pending_op IN ('create', 'update', 'delete')
  )
);

CREATE INDEX IF NOT EXISTS transactions_local_user_idx
  ON transactions_local (user_id);

CREATE INDEX IF NOT EXISTS transactions_local_occurred_idx
  ON transactions_local (occurred_at DESC);

CREATE INDEX IF NOT EXISTS transactions_local_updated_idx
  ON transactions_local (updated_at);

CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  entity TEXT NOT NULL CHECK (entity = 'transaction'),
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('create', 'update', 'soft_delete')),
  payload_json TEXT NOT NULL,
  base_updated_at TEXT,
  created_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'acked', 'failed'))
);

CREATE INDEX IF NOT EXISTS outbox_entity_pending_idx
  ON outbox (user_id, entity, entity_id, status, seq);

CREATE TABLE IF NOT EXISTS sync_meta (
  user_id TEXT PRIMARY KEY NOT NULL,
  last_pulled_at TEXT,
  last_sync_at TEXT,
  last_sync_error TEXT
);
`;

export async function readUserVersion(db: SqlExecutor): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const version = Number(row?.user_version ?? 0);
  return Number.isFinite(version) ? version : 0;
}

/** Apply local schema migrations. Safe to call more than once. */
export async function migrateOfflineSchema(db: SqlExecutor): Promise<void> {
  const current = await readUserVersion(db);
  if (current >= OFFLINE_SCHEMA_VERSION) return;
  if (current < 1) {
    await db.exec(OFFLINE_SCHEMA_V1_SQL);
    await db.exec('PRAGMA user_version = 1');
  }
}

export async function withSqlTransaction(
  db: SqlExecutor,
  task: () => Promise<void>
): Promise<void> {
  await db.exec('BEGIN IMMEDIATE');
  try {
    await task();
    await db.exec('COMMIT');
  } catch (error) {
    try {
      await db.exec('ROLLBACK');
    } catch {
      // The original error is the one callers need.
    }
    throw error;
  }
}
