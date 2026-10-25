/** Confirm phrase for Wipe my data (case-insensitive compare in UI). */
export const WIPE_CONFIRM_PHRASE = 'WIPE';

/** Confirm phrase for Delete my account. */
export const DELETE_CONFIRM_PHRASE = 'DELETE';

/** Format an ISO timestamptz for banner / confirm copy (e.g. November 24, 2026). */
export function formatBackupDeadline(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** True when typed confirm matches the required phrase (trim + case-insensitive). */
export function matchesConfirmPhrase(
  typed: string,
  required: string
): boolean {
  return typed.trim().toUpperCase() === required.trim().toUpperCase();
}
