/**
 * Personal Stats local aggregates — visibility + totals/pie/trend shapes.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from './transactionModel.ts';
import {
  aggregateCategoryTotals,
  aggregatePeriodTotals,
  aggregateTrend,
  filterCategoryTransactions,
  filterStatsTransactions,
  trendBucketStart,
} from './statsLocal.ts';

const tz = 'UTC';
const now = new Date('2026-10-27T12:00:00.000Z');

function txn(
  partial: Partial<Transaction> &
    Pick<Transaction, 'id' | 'amount' | 'type' | 'category' | 'occurred_at'>
): Transaction {
  return {
    user_id: 'user-a',
    note: null,
    currency: 'HKD',
    recurring_series_id: null,
    occurrence_key: null,
    deleted_at: null,
    created_at: partial.occurred_at,
    updated_at: partial.occurred_at,
    ...partial,
  };
}

describe('filterStatsTransactions', () => {
  const start = new Date('2026-10-01T00:00:00.000Z');
  const end = new Date('2026-11-01T00:00:00.000Z');

  it('keeps one-offs in range, including future dates', () => {
    const rows = [
      txn({
        id: '1',
        amount: 10,
        type: 'expense',
        category: 'Food',
        occurred_at: '2026-10-15T12:00:00.000Z',
      }),
      txn({
        id: '2',
        amount: 20,
        type: 'expense',
        category: 'Food',
        occurred_at: '2026-10-30T12:00:00.000Z',
      }),
      txn({
        id: 'out',
        amount: 99,
        type: 'expense',
        category: 'Food',
        occurred_at: '2026-09-30T12:00:00.000Z',
      }),
    ];
    const scoped = filterStatsTransactions(rows, start, end, tz, now);
    assert.deepEqual(
      scoped.map((t) => t.id).sort(),
      ['1', '2']
    );
  });

  it('hides future recurring; keeps due recurring', () => {
    const rows = [
      txn({
        id: 'due',
        amount: 50,
        type: 'expense',
        category: 'Rent',
        occurred_at: '2026-10-20T12:00:00.000Z',
        recurring_series_id: 'series-1',
      }),
      txn({
        id: 'future',
        amount: 50,
        type: 'expense',
        category: 'Rent',
        occurred_at: '2026-10-28T12:00:00.000Z',
        recurring_series_id: 'series-1',
      }),
    ];
    const scoped = filterStatsTransactions(rows, start, end, tz, now);
    assert.deepEqual(
      scoped.map((t) => t.id),
      ['due']
    );
  });
});

describe('aggregatePeriodTotals + category', () => {
  const rows = [
    txn({
      id: 'e1',
      amount: 40,
      type: 'expense',
      category: 'Food',
      occurred_at: '2026-10-10T12:00:00.000Z',
    }),
    txn({
      id: 'e2',
      amount: 10,
      type: 'expense',
      category: 'Food',
      occurred_at: '2026-10-11T12:00:00.000Z',
    }),
    txn({
      id: 'e3',
      amount: 25,
      type: 'expense',
      category: 'Transport',
      occurred_at: '2026-10-12T12:00:00.000Z',
    }),
    txn({
      id: 'i1',
      amount: 100,
      type: 'income',
      category: 'Salary',
      occurred_at: '2026-10-01T12:00:00.000Z',
    }),
  ];

  it('sums expense and income with net', () => {
    assert.deepEqual(aggregatePeriodTotals(rows), {
      expenseSum: 75,
      incomeSum: 100,
      expenseCount: 3,
      incomeCount: 1,
      net: 25,
    });
  });

  it('groups pie rows by category descending sum', () => {
    assert.deepEqual(aggregateCategoryTotals(rows, 'expense'), [
      { category: 'Food', type: 'expense', sum: 50, count: 2 },
      { category: 'Transport', type: 'expense', sum: 25, count: 1 },
    ]);
    assert.deepEqual(aggregateCategoryTotals(rows, 'income'), [
      { category: 'Salary', type: 'income', sum: 100, count: 1 },
    ]);
  });
});

describe('aggregateTrend', () => {
  it('buckets by month in the account timezone', () => {
    const rows = [
      txn({
        id: 'a',
        amount: 30,
        type: 'expense',
        category: 'Food',
        occurred_at: '2026-09-15T12:00:00.000Z',
      }),
      txn({
        id: 'b',
        amount: 70,
        type: 'expense',
        category: 'Food',
        occurred_at: '2026-10-05T12:00:00.000Z',
      }),
      txn({
        id: 'c',
        amount: 20,
        type: 'income',
        category: 'Side',
        occurred_at: '2026-10-20T12:00:00.000Z',
      }),
    ];
    const expense = aggregateTrend(rows, 'expense', 'month', tz);
    assert.equal(expense.length, 2);
    assert.equal(expense[0]!.total, 30);
    assert.equal(expense[1]!.total, 70);

    const net = aggregateTrend(rows, 'net', 'month', tz);
    const oct = net.find((p) => p.bucketStart.startsWith('2026-10'));
    assert.equal(oct?.total, -50);
  });

  it('uses Monday week starts', () => {
    // 2026-10-27 is Tuesday UTC → week starts Monday 2026-10-26
    const start = trendBucketStart(
      '2026-10-27T15:00:00.000Z',
      'week',
      tz
    );
    assert.ok(start);
    assert.equal(start!.toISOString(), '2026-10-26T00:00:00.000Z');
  });
});

describe('filterCategoryTransactions', () => {
  it('returns matching personal rows newest first', () => {
    const rows = [
      txn({
        id: 'old',
        amount: 5,
        type: 'expense',
        category: 'Food',
        occurred_at: '2026-10-05T12:00:00.000Z',
      }),
      txn({
        id: 'new',
        amount: 8,
        type: 'expense',
        category: 'Food',
        occurred_at: '2026-10-20T12:00:00.000Z',
      }),
      txn({
        id: 'other',
        amount: 9,
        type: 'expense',
        category: 'Rent',
        occurred_at: '2026-10-20T12:00:00.000Z',
      }),
    ];
    const listed = filterCategoryTransactions(rows, {
      type: 'expense',
      category: 'Food',
      start: new Date('2026-10-01T00:00:00.000Z'),
      end: new Date('2026-11-01T00:00:00.000Z'),
      timeZone: tz,
      now,
    });
    assert.deepEqual(
      listed.map((t) => t.id),
      ['new', 'old']
    );
  });
});
