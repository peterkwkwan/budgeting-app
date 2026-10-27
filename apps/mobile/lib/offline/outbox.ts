/**
 * Outbox enqueue for transaction edits.
 * Coalesce rule (plan §5): one open row per transaction (pending or failed).
 * A create that is deleted before a successful push is dropped (never sent).
 * Push / pull live in `syncEngine.ts`. Failed rows stay queued for retry.
 */
import type { SqlExecutor } from './schema';
import type { OutboxOp, OutboxRow, OutboxStatus } from './types';

export type EnqueueResult = 'enqueued' | 'coalesced' | 'cancelled';

export type EnqueueTransactionChange = {
  userId: string;
  entityId: string;
  op: OutboxOp;
  payload: unknown;
  /** updated_at observed before this edit. Ignored when coalescing onto an older pending row. */
  baseUpdatedAt: string | null;
  now: string;
  outboxId: string;
};

export async function listPendingOutbox(
  db: SqlExecutor,
  userId: string,
  entityId?: string
): Promise<OutboxRow[]> {
  return listOutboxByStatus(db, userId, ['pending'], entityId);
}

/** Pending and failed rows, FIFO. Failed rows are retried, not dropped. */
export async function listOpenOutbox(
  db: SqlExecutor,
  userId: string,
  entityId?: string
): Promise<OutboxRow[]> {
  return listOutboxByStatus(db, userId, ['pending', 'failed'], entityId);
}

async function listOutboxByStatus(
  db: SqlExecutor,
  userId: string,
  statuses: readonly OutboxStatus[],
  entityId?: string
): Promise<OutboxRow[]> {
  const marks = statuses.map(() => '?').join(', ');
  const sql = entityId
    ? `SELECT * FROM outbox
       WHERE user_id = ? AND entity = 'transaction' AND entity_id = ? AND status IN (${marks})
       ORDER BY seq ASC`
    : `SELECT * FROM outbox
       WHERE user_id = ? AND entity = 'transaction' AND status IN (${marks})
       ORDER BY seq ASC`;
  const params = entityId
    ? [userId, entityId, ...statuses]
    : [userId, ...statuses];
  const rows = await db.all<Record<string, unknown>>(sql, params);
  return rows.map(mapOutboxRow);
}

/** Drop open rows (pending or failed) for one transaction. Does not touch acked history. */
export async function deletePendingOutbox(
  db: SqlExecutor,
  userId: string,
  entityId: string
): Promise<void> {
  await db.run(
    `DELETE FROM outbox
     WHERE user_id = ? AND entity = 'transaction' AND entity_id = ?
       AND status IN ('pending', 'failed')`,
    [userId, entityId]
  );
}

export async function enqueueTransactionChange(
  db: SqlExecutor,
  change: EnqueueTransactionChange
): Promise<EnqueueResult> {
  const pending = await listOpenOutbox(db, change.userId, change.entityId);
  const payloadJson = JSON.stringify(change.payload);

  if (change.op === 'soft_delete' && pending.some((row) => row.op === 'create')) {
    await deletePendingOutbox(db, change.userId, change.entityId);
    return 'cancelled';
  }

  if (pending.length > 0) {
    const head = pending[0];
    const nextOp: OutboxOp =
      head.op === 'create' && change.op !== 'soft_delete' ? 'create' : change.op;
    const baseUpdatedAt = head.op === 'create' ? null : head.base_updated_at;
    await db.run(
      `UPDATE outbox
       SET op = ?, payload_json = ?, base_updated_at = ?, status = 'pending', last_error = NULL
       WHERE seq = ?`,
      [nextOp, payloadJson, baseUpdatedAt, head.seq]
    );
    if (pending.length > 1) {
      await db.run(
        `DELETE FROM outbox
         WHERE user_id = ? AND entity = 'transaction' AND entity_id = ?
           AND status IN ('pending', 'failed') AND seq != ?`,
        [change.userId, change.entityId, head.seq]
      );
    }
    return 'coalesced';
  }

  await db.run(
    `INSERT INTO outbox (
      id, user_id, entity, entity_id, op, payload_json, base_updated_at,
      created_at, attempts, last_error, status
    ) VALUES (?, ?, 'transaction', ?, ?, ?, ?, ?, 0, NULL, 'pending')`,
    [
      change.outboxId,
      change.userId,
      change.entityId,
      change.op,
      payloadJson,
      change.baseUpdatedAt,
      change.now,
    ]
  );
  return 'enqueued';
}

function mapOutboxRow(row: Record<string, unknown>): OutboxRow {
  return {
    seq: Number(row.seq),
    id: String(row.id),
    user_id: String(row.user_id),
    entity: 'transaction',
    entity_id: String(row.entity_id),
    op: asOp(row.op),
    payload_json: String(row.payload_json),
    base_updated_at:
      row.base_updated_at == null ? null : String(row.base_updated_at),
    created_at: String(row.created_at),
    attempts: Number(row.attempts),
    last_error: row.last_error == null ? null : String(row.last_error),
    status: asStatus(row.status),
  };
}

function asOp(value: unknown): OutboxOp {
  if (value === 'create' || value === 'update' || value === 'soft_delete') {
    return value;
  }
  throw new Error('Invalid outbox op.');
}

function asStatus(value: unknown): OutboxStatus {
  if (value === 'pending' || value === 'acked' || value === 'failed') return value;
  throw new Error('Invalid outbox status.');
}
