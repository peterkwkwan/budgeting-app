/**
 * Phase 0 spike: open SQLite, create a tiny table, insert + select one row.
 * Not wired into production UI. Call only from manual smoke / debug.
 *
 * Requires a Dev Client rebuild after adding `expo-sqlite` / NetInfo
 * (Expo Go may include sqlite on some SDKs; Fudget uses a custom Dev Client).
 */
import * as SQLite from 'expo-sqlite';

import { newClientId } from './ids';

const SPIKE_DB_NAME = 'fudget_offline_spike.db';

export type SqliteSpikeResult = {
  ok: true;
  id: string;
  value: string;
};

/**
 * Smoke-test local SQLite open/create/insert/select.
 * Not imported by screens — call manually for Dev Client smoke.
 */
export async function runSqliteSpike(): Promise<SqliteSpikeResult> {
  const db = await SQLite.openDatabaseAsync(SPIKE_DB_NAME);
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS spike_probe (
        id TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);

    const id = newClientId();
    const value = 'hello-offline';
    await db.runAsync(
      'INSERT INTO spike_probe (id, value) VALUES (?, ?)',
      id,
      value,
    );

    const row = await db.getFirstAsync<{ id: string; value: string }>(
      'SELECT id, value FROM spike_probe WHERE id = ?',
      id,
    );

    if (!row || row.value !== value) {
      throw new Error('sqliteSpike: select did not return the inserted row');
    }

    return { ok: true, id: row.id, value: row.value };
  } finally {
    await db.closeAsync();
  }
}
