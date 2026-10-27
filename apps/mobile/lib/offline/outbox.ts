/**
 * Outbox enqueue for transaction edits. Writes rows only — no push/pull.
 * Coalesce rule (plan §5): one pending row per transaction.
 * A pending create that is deleted before push is dropped (never sent).
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
  const sql = entityId
    ? `SELECT * FROM outbox
       WHERE user_id = ? AND entity = 'transaction' AND entity_id = ? AND status = 'pending'
       ORDER BY seq ASC`
    : `SELECT * FROM outbox
       WHERE user_id = ? AND entity = 'transaction' AND status = 'pending'
       ORDER BY seq ASC`;
  const params = entityId ? [userId, entityId] : [userId];
  const rows = await db.all<Record<string, unknown>>(sql, params);
  return rows.map(mapOutboxRow);
}

export async function deletePendingOutbox(
  db: SqlExecutor,
  userId: string,
  entityId: string
): Promise<void> {
  await db.run(
    `DELETE FROM outbox
     WHERE user_id = ? AND entity = 'transaction' AND entity_id = ? AND status = 'pending'`,
    [userId, entityId]
  );
}

export async function enqueueTransactionChange(
  db: SqlExecutor,
  change: EnqueueTransactionChange
): Promise<EnqueueResult> {
  const pending = await listPendingOutbox(db, change.userId, change.entityId);
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
       SET op = ?, payload_json = ?, base_updated_at = ?
       WHERE seq = ?`,
      [nextOp, payloadJson, baseUpdatedAt, head.seq]
    );
    if (pending.length > 1) {
      await db.run(
        `DELETE FROM outbox
         WHERE user_id = ? AND entity = 'transaction' AND entity_id = ? AND status = 'pending' AND seq != ?`,
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
