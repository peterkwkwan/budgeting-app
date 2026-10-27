/**
 * Last-known custom categories for offline transaction create.
 * System categories live in constants and do not need this cache.
 */
import type { SqlExecutor } from './schema';

export async function saveCategoryCache<T>(
  db: SqlExecutor,
  userId: string,
  rows: T[],
  now: string
): Promise<void> {
  await db.run(
    `INSERT INTO category_cache (user_id, payload_json, saved_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       saved_at = excluded.saved_at`,
    [userId, JSON.stringify(rows), now]
  );
}

/** Null when this user has never cached a list. An empty array is a real cache. */
export async function readCategoryCache<T>(
  db: SqlExecutor,
  userId: string
): Promise<T[] | null> {
  const row = await db.first<{ payload_json: string }>(
    'SELECT payload_json FROM category_cache WHERE user_id = ?',
    [userId]
  );
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.payload_json) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/**
 * Prefer a fresh server list and remember it.
 * On failure, return the last saved list. Rethrow when nothing was saved.
 */
export async function loadCachedOrFreshCategories<T>(
  db: SqlExecutor,
  userId: string,
  fresh: () => Promise<T[]>,
  now: string
): Promise<T[]> {
  try {
    const rows = await fresh();
    await saveCategoryCache(db, userId, rows, now);
    return rows;
  } catch (error) {
    const cached = await readCategoryCache<T>(db, userId);
    if (cached) return cached;
    throw error;
  }
}
