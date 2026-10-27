/**
 * Personal Stats aggregates from an in-memory transaction list.
 * Used offline when OFFLINE_TXNS_ENABLED — same shapes as the personal RPCs.
 * No network and no SQLite.
 */
import type { TransactionType } from '@/constants/categories';
import { zonedMidnight, zonedYmd } from '@/lib/dates';
import type { TrendBucket } from '@/lib/periods';
import {
  filterTransactionsVisible,
  type Transaction,
} from '@/lib/transactionModel';
import { weekdayMon0 } from '@/lib/transactionsDateView';

import type {
  CategoryTotal,
  PeriodTotals,
  StatsMetric,
  TrendPoint,
} from './stats';

/**
 * Soft-deleted already omitted by the local list. Recurring ≤ local today;
 * one-offs may be future. Then clip to [start, end).
 */
export function filterStatsTransactions(
  rows: Transaction[],
  start: Date,
  end: Date,
  timeZone: string,
  now: Date = new Date()
): Transaction[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return filterTransactionsVisible(rows, timeZone, now).filter((t) => {
    const occurred = new Date(t.occurred_at).getTime();
    if (Number.isNaN(occurred)) return false;
    return occurred >= startMs && occurred < endMs;
  });
}

export function aggregateCategoryTotals(
  rows: Transaction[],
  type: TransactionType
): CategoryTotal[] {
  const byCategory = new Map<string, { sum: number; count: number }>();
  for (const t of rows) {
    if (t.type !== type) continue;
    const cur = byCategory.get(t.category) ?? { sum: 0, count: 0 };
    cur.sum += t.amount;
    cur.count += 1;
    byCategory.set(t.category, cur);
  }
  return [...byCategory.entries()]
    .map(([category, { sum, count }]) => ({
      category,
      type,
      sum,
      count,
    }))
    .sort((a, b) => b.sum - a.sum || a.category.localeCompare(b.category));
}

export function aggregatePeriodTotals(rows: Transaction[]): PeriodTotals {
  let expenseSum = 0;
  let incomeSum = 0;
  let expenseCount = 0;
  let incomeCount = 0;
  for (const t of rows) {
    if (t.type === 'expense') {
      expenseSum += t.amount;
      expenseCount += 1;
    } else if (t.type === 'income') {
      incomeSum += t.amount;
      incomeCount += 1;
    }
  }
  return {
    expenseSum,
    incomeSum,
    expenseCount,
    incomeCount,
    net: incomeSum - expenseSum,
  };
}

/** Bucket start instant in `timeZone` (matches profile-TZ date_trunc). */
export function trendBucketStart(
  occurredAt: string,
  bucket: TrendBucket,
  timeZone: string
): Date | null {
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return null;
  const { year, month, day } = zonedYmd(date, timeZone);

  if (bucket === 'day') {
    return zonedMidnight(year, month, day, timeZone);
  }
  if (bucket === 'month') {
    return zonedMidnight(year, month, 1, timeZone);
  }
  if (bucket === 'year') {
    return zonedMidnight(year, 1, 1, timeZone);
  }
  // week — Monday start (Postgres date_trunc('week'))
  const monOffset = weekdayMon0(year, month, day);
  const monday = new Date(Date.UTC(year, month - 1, day - monOffset));
  return zonedMidnight(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
    timeZone
  );
}

export function aggregateTrend(
  rows: Transaction[],
  metric: StatsMetric,
  bucket: TrendBucket,
  timeZone: string
): TrendPoint[] {
  const byBucket = new Map<string, { income: number; expense: number }>();

  for (const t of rows) {
    if (metric !== 'net' && t.type !== metric) continue;
    const start = trendBucketStart(t.occurred_at, bucket, timeZone);
    if (!start) continue;
    const key = start.toISOString();
    const cur = byBucket.get(key) ?? { income: 0, expense: 0 };
    if (t.type === 'income') cur.income += t.amount;
    else if (t.type === 'expense') cur.expense += t.amount;
    byBucket.set(key, cur);
  }

  return [...byBucket.entries()]
    .map(([bucketStart, { income, expense }]) => ({
      bucketStart,
      total:
        metric === 'net'
          ? income - expense
          : metric === 'income'
            ? income
            : expense,
    }))
    .sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));
}

/** Personal category drill-down filter (same rules as online listCategoryTransactions). */
export function filterCategoryTransactions(
  rows: Transaction[],
  params: {
    type: TransactionType;
    category: string;
    start: Date;
    end: Date;
    timeZone: string;
    now?: Date;
  }
): Transaction[] {
  const scoped = filterStatsTransactions(
    rows,
    params.start,
    params.end,
    params.timeZone,
    params.now
  );
  return scoped
    .filter((t) => t.type === params.type && t.category === params.category)
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    );
}
