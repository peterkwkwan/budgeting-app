/**
 * Feature flag for transactions-only offline (SQLite mirror + outbox + sync).
 * Phases 3–4 ship banners, gates, and wipe/restore/convert/category edges behind this flag.
 * Keep false so production UI stays on the Supabase path until a later flip.
 */
export const OFFLINE_TXNS_ENABLED = false;
