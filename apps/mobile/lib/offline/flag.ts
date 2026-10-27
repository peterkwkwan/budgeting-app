/**
 * Feature flag for transactions-only offline (SQLite mirror + outbox + sync).
 * On: Transactions list and one-off writes use the local mirror. Sync runs on
 * foreground and reconnect. A Dev Client rebuild is required for expo-sqlite.
 */
export const OFFLINE_TXNS_ENABLED = true;
