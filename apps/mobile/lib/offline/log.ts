/**
 * Offline diagnostics. The line is an operation and an id.
 * Amounts, notes, and error payloads are not included.
 */

const OPS = new Set([
  'create',
  'update',
  'soft_delete',
  'delete',
  'pull',
  'push',
  'clear',
  'reset',
  'sync',
]);

export type OfflineLogDetail = {
  op?: string;
  id?: string;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One console line: event, op, and a transaction id. Nothing else. */
export function formatOfflineLog(
  event: string,
  detail?: OfflineLogDetail
): string {
  const eventText = sanitizeEvent(event);
  const op = detail?.op && OPS.has(detail.op) ? detail.op : '';
  const id = detail?.id && UUID.test(detail.id) ? detail.id : '';
  let line = `[offline] ${eventText}`;
  if (op) line += ` op=${op}`;
  if (id) line += ` id=${id}`;
  return line;
}

export function logOffline(event: string, detail?: OfflineLogDetail): void {
  console.warn(formatOfflineLog(event, detail));
}

function sanitizeEvent(event: string): string {
  const cleaned = event
    .toLowerCase()
    .replace(/[^a-z -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return cleaned || 'sync';
}
