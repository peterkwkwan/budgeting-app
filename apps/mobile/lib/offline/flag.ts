/**
 * Feature flag for transactions-only offline (SQLite mirror + outbox).
 * Phase 0: keep false — contracts + spike only; production UI stays online-first.
 */
export const OFFLINE_TXNS_ENABLED = false;
