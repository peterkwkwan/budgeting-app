/**
 * Open the on-device offline database and migrate it.
 * Callers import this module statically (so the open helper is already in the
 * JS bundle). expo-sqlite itself stays a lazy import so Node unit tests that
 * inject a fake DB never load the native module.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  migrateOfflineSchema,
  type SqlExecutor,
  type SqlValue,
} from './schema';

export const OFFLINE_DB_NAME = 'fudget_offline.db';

let opening: Promise<SqlExecutor> | null = null;

export function getOfflineDb(): Promise<SqlExecutor> {
  if (!opening) {
    opening = openOfflineDatabase().catch((error) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

async function openOfflineDatabase(): Promise<SqlExecutor> {
  // First open should happen while online (sync status / foreground sync).
  // After that, `opening` is cached and offline writes need no Metro fetch.
  const SQLite = await import('expo-sqlite');
  const sqlite = await SQLite.openDatabaseAsync(OFFLINE_DB_NAME);
  const db = wrapExpoSqlite(sqlite);
  await db.exec('PRAGMA journal_mode = WAL;');
  await migrateOfflineSchema(db);
  return db;
}

function bind<T>(
  params: readonly SqlValue[] | undefined,
  run: (params?: SqlValue[]) => Promise<T>
): Promise<T> {
  if (!params || params.length === 0) return run();
  return run([...params]);
}

function wrapExpoSqlite(sqlite: SQLiteDatabase): SqlExecutor {
  return {
    exec(sql) {
      return sqlite.execAsync(sql);
    },
    run(sql, params) {
      return bind(params, (bound) => sqlite.runAsync(sql, bound ?? [])).then(
        () => undefined
      );
    },
    all<Row>(sql: string, params?: readonly SqlValue[]) {
      return bind(params, (bound) => sqlite.getAllAsync<Row>(sql, bound ?? []));
    },
    async first<Row>(sql: string, params?: readonly SqlValue[]) {
      const row = await bind(params, (bound) =>
        sqlite.getFirstAsync<Row>(sql, bound ?? [])
      );
      return row ?? null;
    },
  };
}
