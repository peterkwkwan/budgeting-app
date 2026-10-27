/**
 * Offline transactions — Phase 0 contracts + spike.
 * Production path stays online until OFFLINE_TXNS_ENABLED and later phases.
 */
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
