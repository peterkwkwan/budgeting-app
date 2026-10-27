/**
 * Offline transactions.
 * Phase 0: contracts + SQLite spike.
 * Phase 1: local schema, mirror CRUD, and transactionsRepo (SQLite + outbox).
 * Production UI stays on Supabase while OFFLINE_TXNS_ENABLED is false.
 * Import the repo from `./transactionsRepo` directly — this barrel still
 * loads the Phase 0 spike, which imports expo-sqlite.
 */
export { OFFLINE_SCHEMA_VERSION } from './schema';
export { OFFLINE_TXNS_ENABLED } from './flag';
export { newClientId } from './ids';
export { runSqliteSpike, type SqliteSpikeResult } from './sqliteSpike';
export type {
  OutboxOp,
  OutboxRow,
  OutboxStatus,
  PendingOp,
  SyncCursor,
  SyncMetaRow,
  TransactionLocalRow,
} from './types';
