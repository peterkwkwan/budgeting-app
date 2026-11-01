import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from './transactions.ts';
import {
  clampDayInMonth,
  dateKeyFromFocusDay,
  dayNetsInMonth,
  daysInMonth,
  formatDayNet,
  monthGridCells,
  netOfTransactions,
  weekdayMon0,
  weekdaySun0,
  weekDaysAround,
} from './transactionsDateView.ts';

function txn(
  partial: Pick<Transaction, 'amount' | 'type' | 'occurred_at'> &
    Partial<Transaction>
): Transaction {
  return {
    id: partial.id ?? partial.occurred_at,
    user_id: 'u',
    category: partial.type === 'income' ? 'Salary' : 'Groceries',
    note: null,
    currency: 'USD',
    recurring_series_id: null,
    occurrence_key: null,
    deleted_at: null,
    created_at: partial.occurred_at,
    updated_at: partial.occurred_at,
    ...partial,
  };
}

describe('transactionsDateView', () => {
  it('daysInMonth handles leap February', () => {
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2025, 2), 28);
    assert.equal(daysInMonth(2026, 10), 31);
  });

  it('weekdaySun0 for Oct 2026 (Thu start)', () => {
    // 2026-10-01 is Thursday → 4
    assert.equal(weekdaySun0(2026, 10, 1), 4);
    assert.equal(weekdayMon0(2026, 10, 1), 3);
  });

  it('monthGridCells pads Sunday-start October 2026', () => {
    const cells = monthGridCells({ year: 2026, month: 10 });
    assert.equal(cells[0], null);
    assert.equal(cells[1], null);
    assert.equal(cells[2], null);
    assert.equal(cells[3], null);
    assert.equal(cells[4], 1);
    assert.equal(cells.filter((c) => c != null).length, 31);
    assert.equal(cells.length % 7, 0);
  });

  it('weekDaysAround uses Monday-start week', () => {
    // Oct 23 2026 is Friday → week Mon 19 … Sun 25
    const week = weekDaysAround({ year: 2026, month: 10 }, 23);
    assert.equal(week.length, 7);
    assert.equal(week[0]?.day, 19);
    assert.equal(week[0]?.inFocusMonth, true);
    assert.equal(week[6]?.day, 25);
  });

  it('clampDayInMonth and dateKeyFromFocusDay', () => {
    assert.equal(clampDayInMonth(2026, 2, 31), 28);
    assert.equal(dateKeyFromFocusDay({ year: 2026, month: 10 }, 3), '2026-10-03');
  });

  it('netOfTransactions is income minus expenses, rounded to cents', () => {
    assert.equal(netOfTransactions([]), null);
    assert.equal(
      netOfTransactions([
        txn({ type: 'income', amount: 12, occurred_at: '2026-10-24T15:00:00Z' }),
        txn({ type: 'expense', amount: 18.75, occurred_at: '2026-10-24T16:00:00Z' }),
      ]),
      -6.75
    );
    assert.equal(
      netOfTransactions([
        txn({ type: 'income', amount: 0.1, occurred_at: '2026-10-24T15:00:00Z' }),
        txn({ type: 'income', amount: 0.2, occurred_at: '2026-10-24T16:00:00Z' }),
      ]),
      0.3
    );
  });

  it('dayNetsInMonth groups by local day and skips other months', () => {
    const rows = [
      // 2026-10-24 03:00Z is still Oct 23 in Los Angeles.
      txn({
        type: 'expense',
        amount: 18.75,
        occurred_at: '2026-10-24T03:00:00Z',
      }),
      txn({
        type: 'income',
        amount: 12,
        occurred_at: '2026-10-24T15:00:00Z',
      }),
      txn({
        type: 'expense',
        amount: 6.25,
        occurred_at: '2026-10-24T18:00:00Z',
      }),
      txn({
        type: 'income',
        amount: 100,
        occurred_at: '2026-11-01T15:00:00Z',
      }),
    ];
    const nets = dayNetsInMonth(rows, { year: 2026, month: 10 }, 'America/Los_Angeles');
    assert.equal(nets.get(23), -18.75);
    assert.equal(nets.get(24), 5.75);
    assert.equal(nets.has(1), false);
    assert.equal(nets.has(25), false);
  });

  it('formatDayNet uses income and expense signs', () => {
    assert.deepEqual(formatDayNet(18.75, { currency: 'USD' }), {
      text: '+$18.75',
      tone: 'income',
    });
    assert.deepEqual(formatDayNet(-12, { currency: 'USD' }), {
      text: '−$12.00',
      tone: 'expense',
    });
    assert.deepEqual(formatDayNet(0, { currency: 'USD' }), {
      text: '$0.00',
      tone: 'zero',
    });
    assert.deepEqual(formatDayNet(1500, { currency: 'USD' }), {
      text: '+$1,500.00',
      tone: 'income',
    });
    assert.deepEqual(formatDayNet(1500, { compact: true, currency: 'USD' }), {
      text: '+$1.5k',
      tone: 'income',
    });
    assert.deepEqual(
      formatDayNet(-250000, { compact: true, currency: 'USD' }),
      {
        text: '−$250k',
        tone: 'expense',
      }
    );
    assert.deepEqual(formatDayNet(18.75, { currency: 'HKD' }), {
      text: '+HK$18.75',
      tone: 'income',
    });
  });

  it('formatDayNet plain drops symbol and cent decimals for calendar cells', () => {
    assert.deepEqual(
      formatDayNet(-758, { compact: true, plain: true, currency: 'HKD' }),
      { text: '−758', tone: 'expense' }
    );
    assert.deepEqual(
      formatDayNet(-758.49, { compact: true, plain: true, currency: 'HKD' }),
      { text: '−758', tone: 'expense' }
    );
    assert.deepEqual(
      formatDayNet(80.5, { compact: true, plain: true, currency: 'HKD' }),
      { text: '+81', tone: 'income' }
    );
    assert.deepEqual(
      formatDayNet(0, { compact: true, plain: true, currency: 'HKD' }),
      { text: '0', tone: 'zero' }
    );
    assert.deepEqual(
      formatDayNet(-5200, { compact: true, plain: true, currency: 'HKD' }),
      { text: '−5.2k', tone: 'expense' }
    );
    assert.deepEqual(
      formatDayNet(93200, { compact: true, plain: true, currency: 'HKD' }),
      { text: '+93.2k', tone: 'income' }
    );
    assert.deepEqual(
      formatDayNet(-1700, { compact: true, plain: true, currency: 'HKD' }),
      { text: '−1.7k', tone: 'expense' }
    );
    assert.deepEqual(
      formatDayNet(2000, { compact: true, plain: true, currency: 'HKD' }),
      { text: '+2k', tone: 'income' }
    );
  });
});
