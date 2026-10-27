/**
 * Offline logs are op + id. Amounts and error text stay out of the line.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatOfflineLog } from './log.ts';

const TXN = '11111111-1111-4111-8111-111111111111';

describe('offline log', () => {
  it('prints the operation and the transaction id', () => {
    assert.equal(
      formatOfflineLog('push failed', { op: 'update', id: TXN }),
      `[offline] push failed op=update id=${TXN}`
    );
    assert.equal(
      formatOfflineLog('sign-out clear failed', { op: 'clear' }),
      '[offline] sign-out clear failed op=clear'
    );
  });

  it('drops amounts, notes, and non-uuid ids', () => {
    const detail = {
      op: 'update',
      id: '12.50',
      amount: 18.5,
      note: 'coffee',
    };
    const line = formatOfflineLog('push failed 12.50', detail);
    assert.equal(line, '[offline] push failed op=update');
    assert.equal(line.includes('12'), false);
    assert.equal(line.includes('18'), false);
    assert.equal(line.includes('coffee'), false);
  });
});
