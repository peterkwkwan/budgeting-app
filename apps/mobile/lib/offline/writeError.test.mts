import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { userFacingOfflineWriteError } from './writeError.ts';

describe('userFacingOfflineWriteError', () => {
  it('replaces Metro bundle-fetch noise', () => {
    const message = userFacingOfflineWriteError(
      new Error('Could not load bundle'),
      'Could not save.'
    );
    assert.match(message, /offline save/i);
    assert.equal(message.includes('Could not load bundle'), false);
  });

  it('keeps real domain errors', () => {
    assert.equal(
      userFacingOfflineWriteError(
        new Error('Enter an amount greater than zero.'),
        'Could not save.'
      ),
      'Enter an amount greater than zero.'
    );
  });

  it('uses the fallback when there is no message', () => {
    assert.equal(
      userFacingOfflineWriteError({}, 'Could not delete.'),
      'Could not delete.'
    );
  });
});
