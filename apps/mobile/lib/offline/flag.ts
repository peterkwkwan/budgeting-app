/**
 * Feature flag for transactions-only offline (SQLite mirror + outbox).
 * Phase 1 ships the schema and repository behind this flag.
 * Keep false so production UI stays on the Supabase path.
 */
export const OFFLINE_TXNS_ENABLED = false;
