/**
 * Local offline contracts for transactions-only sync (plan §5).
 * Contracts only — no schema migrations or sync engine in Phase 0.
 */

export type PendingOp = 'create' | 'update' | 'delete';

export type OutboxOp = 'create' | 'update' | 'soft_delete';

export type OutboxStatus = 'pending' | 'acked' | 'failed';

/** Mirror of cloud `transactions` plus a denormalized pending hint for UI. */
export type TransactionLocalRow = {
  id: string;
  user_id: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  note: string | null;
  currency: string;
  occurred_at: string;
  recurring_series_id: string | null;
  occurrence_key: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** Denormalized hint for pending badge; null when fully synced. */
  pending_op: PendingOp | null;
};

/** FIFO outbox row waiting to push to Supabase. */
export type OutboxRow = {
  seq: number;
  id: string;
  user_id: string;
  entity: 'transaction';
  entity_id: string;
  op: OutboxOp;
  /** Full row snapshot (create/update) or `{ id, deleted_at }` (soft_delete). */
  payload_json: string;
  /** Remote/local `updated_at` seen before this edit (conflict diagnostics). */
  base_updated_at: string | null;
  created_at: string;
  attempts: number;
  last_error: string | null;
  status: OutboxStatus;
};

/** Per-user sync cursor / last attempt metadata. */
export type SyncMetaRow = {
  user_id: string;
  /** Max remote `updated_at` successfully merged. */
  last_pulled_at: string | null;
  /** Wall clock of last sync attempt. */
  last_sync_at: string | null;
  last_sync_error: string | null;
};

/** Lightweight pull cursor shape used by the sync engine. */
export type SyncCursor = {
  user_id: string;
  last_pulled_at: string | null;
};
