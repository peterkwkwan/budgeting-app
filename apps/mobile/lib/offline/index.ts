/**
 * Offline transactions.
 * Phase 0: contracts + SQLite spike.
 * Phase 1: local schema, mirror CRUD, and transactionsRepo (SQLite + outbox).
 * Phase 2: sync engine (`./syncEngine`) and NetInfo (`./net`). Not re-exported
 * here — this barrel still loads the Phase 0 spike, which imports expo-sqlite.
 * Phase 3: banner, pending badge, and gates live in `hooks/useOfflineGates.ts`.
 * Production UI stays on Supabase while OFFLINE_TXNS_ENABLED is false.
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
