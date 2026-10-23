/**
 * Optional one-shot handoff into Add transaction (e.g. deep link). Mic on Add applies drafts in place.
 * Avoids stuffing notes through URL params.
 */

import type { VoiceDraft } from '@/lib/voiceParse';

let pending: VoiceDraft | null = null;

export function setPendingVoiceDraft(draft: VoiceDraft): void {
  pending = draft;
}

/** Read and clear the pending draft (call once on Add screen mount). */
export function takePendingVoiceDraft(): VoiceDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}

export function peekPendingVoiceDraft(): VoiceDraft | null {
  return pending;
}
