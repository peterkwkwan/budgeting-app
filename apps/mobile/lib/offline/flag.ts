/**
 * Feature flag for transactions-only offline (SQLite mirror + outbox + sync).
 * Phase 2 ships the sync engine behind this flag.
 * Keep false so production UI stays on the Supabase path until a later phase.
 */
export const OFFLINE_TXNS_ENABLED = false;
