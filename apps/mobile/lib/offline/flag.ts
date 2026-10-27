/**
 * Feature flag for transactions-only offline (SQLite mirror + outbox + sync).
 * Phase 3 ships the banner, pending badge, and online-only gates behind this flag.
 * Keep false so production UI stays on the Supabase path until a later flip.
 */
export const OFFLINE_TXNS_ENABLED = false;
