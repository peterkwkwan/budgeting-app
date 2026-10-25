import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DELETE_CONFIRM_PHRASE,
  WIPE_CONFIRM_PHRASE,
  formatBackupDeadline,
  matchesConfirmPhrase,
} from './accountConfirm.ts';

describe('matchesConfirmPhrase', () => {
  it('accepts exact and case-insensitive WIPE', () => {
    assert.equal(matchesConfirmPhrase('WIPE', WIPE_CONFIRM_PHRASE), true);
    assert.equal(matchesConfirmPhrase(' wipe ', WIPE_CONFIRM_PHRASE), true);
    assert.equal(matchesConfirmPhrase('Wipe', WIPE_CONFIRM_PHRASE), true);
  });

  it('rejects near-misses', () => {
    assert.equal(matchesConfirmPhrase('WIP', WIPE_CONFIRM_PHRASE), false);
    assert.equal(matchesConfirmPhrase('DELETE', WIPE_CONFIRM_PHRASE), false);
    assert.equal(matchesConfirmPhrase('', WIPE_CONFIRM_PHRASE), false);
  });

  it('accepts DELETE for account deletion', () => {
    assert.equal(matchesConfirmPhrase('delete', DELETE_CONFIRM_PHRASE), true);
    assert.equal(matchesConfirmPhrase('DELETE', DELETE_CONFIRM_PHRASE), true);
  });
});

describe('formatBackupDeadline', () => {
  it('formats a stable en-US long date', () => {
    const formatted = formatBackupDeadline('2026-11-24T12:00:00.000Z');
    assert.match(formatted, /November/);
    assert.match(formatted, /24/);
    assert.match(formatted, /2026/);
  });

  it('returns em dash for missing or invalid', () => {
    assert.equal(formatBackupDeadline(null), '—');
    assert.equal(formatBackupDeadline(undefined), '—');
    assert.equal(formatBackupDeadline('not-a-date'), '—');
  });
});
