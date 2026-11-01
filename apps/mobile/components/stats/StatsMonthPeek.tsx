import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryBreakdownList } from '@/components/stats/CategoryBreakdownList';
import { CategoryListSkeleton } from '@/components/stats/CategoryListSkeleton';
import { CategoryPieChart } from '@/components/stats/CategoryPieChart';
import { StatsEmptyState } from '@/components/stats/StatsEmptyState';
import { StatsQuietPeers } from '@/components/stats/StatsQuietPeers';
import {
  PIE_TYPE_OPTIONS,
  StatsSegmentToggle,
} from '@/components/stats/StatsSegmentToggle';
import { CaptionText, StrongText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { colors, space } from '@/constants/theme';
import {
  useAggregateStats,
  usePersonalStats,
} from '@/hooks/useStats';
import { resolvePeriodBounds, type PeriodFocus } from '@/lib/periods';
import { savingsRateColor, savingsRatePercent } from '@/lib/savingsRate';

type StatsMonthPeekProps = {
  focus: PeriodFocus;
  timeZone: string;
  pieType: TransactionType;
  /** Mirror the live Stats scope for adjacent peeks. */
  pairLive: boolean;
  formatSigned: (n: number) => string;
};

/**
 * Non-interactive adjacent-month peek for Stats (Monthly).
 * Prefetch warms React Query — peeks render real By-category content when
 * totals are cached. Quiet only when the month is known empty; By-category
 * shell + bones only on a cold cache miss.
 */
export function StatsMonthPeek({
  focus,
  timeZone,
  pieType,
  pairLive,
  formatSigned,
}: StatsMonthPeekProps) {
  const period = useMemo(
    () => resolvePeriodBounds('month', timeZone, { focus }),
    [timeZone, focus.year, focus.month]
  );

  const personal = usePersonalStats(period, pieType);
  const aggregate = useAggregateStats(period, pieType, pairLive);
  const totals = pairLive ? aggregate.totals : personal.totals;
  const categories = pairLive ? aggregate.categories : personal.categories;

  const totalsReady = totals.data != null && !totals.isLoading;
  const categoriesReady = !categories.isLoading;
  const expenseSum = totals.data?.expenseSum ?? 0;
  const incomeSum = totals.data?.incomeSum ?? 0;
  const netSum = totals.data?.net ?? 0;
  const periodSavingsPct = savingsRatePercent(incomeSum, expenseSum);
  const txnCount =
    (totals.data?.expenseCount ?? 0) + (totals.data?.incomeCount ?? 0);
  const knownEmpty = totalsReady && txnCount === 0;
  const peers = [
    { label: 'Spent', value: formatSigned(expenseSum) },
    { label: 'Earned', value: formatSigned(incomeSum) },
    { label: 'Net', value: formatSigned(netSum) },
  ] as const;

  // Known empty only — never use Quiet as a loading stand-in.
  if (knownEmpty) {
    return (
      <View style={styles.emptyRoot}>
        <StatsEmptyState
          periodLabel={period.navLabel}
          preset="month"
          interactive={false}
        />
      </View>
    );
  }

  // Cold miss: By-category shell with donut/list bones (matches settled CLS).
  // Warm cache: same shell with real totals/categories — no empty flash.
  return (
    <View style={styles.root}>
      <StrongText style={styles.sectionTitle}>By category</StrongText>
      <StatsSegmentToggle
        options={PIE_TYPE_OPTIONS}
        value={pieType}
        readOnly
        accessibilityLabel="Category type"
      />
      <CategoryPieChart
        data={categoriesReady ? (categories.data ?? []) : []}
        type={pieType}
        centerTotal={pieType === 'expense' ? expenseSum : incomeSum}
        loading={!totalsReady || !categoriesReady}
        emptyLabel={
          pieType === 'expense'
            ? 'No expenses in this period.'
            : 'No income in this period.'
        }
      />
      <CaptionText
        style={[
          styles.savingsRate,
          { color: savingsRateColor(totalsReady ? periodSavingsPct : null) },
        ]}
      >
        Savings rate{' '}
        {!totalsReady || periodSavingsPct == null
          ? 'n/a'
          : `${periodSavingsPct}%`}
      </CaptionText>
      <StatsQuietPeers peers={peers} placeholder={!totalsReady} />
      {totalsReady && categoriesReady ? (
        <CategoryBreakdownList data={categories.data ?? []} type={pieType} />
      ) : (
        <CategoryListSkeleton />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    // Match settled Stats section rhythm (title → tabs → donut → peers → list).
    gap: space.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
  },
  savingsRate: {
    color: colors.inkMuted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    marginTop: -space.xs,
  },
});
