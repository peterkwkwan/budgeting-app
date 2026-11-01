import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { MonthSwipeSkeleton } from '@/components/MonthSwipeSkeleton';
import { CategoryBreakdownList } from '@/components/stats/CategoryBreakdownList';
import { CategoryPieChart } from '@/components/stats/CategoryPieChart';
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
 * Skeleton while totals/categories load; otherwise real amounts + charts.
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

  // Cache hit from adjacent prefetch → ready immediately; else skeleton only.
  const ready =
    totals.data != null &&
    !totals.isLoading &&
    !categories.isLoading;
  const expenseSum = totals.data?.expenseSum ?? 0;
  const incomeSum = totals.data?.incomeSum ?? 0;
  const netSum = totals.data?.net ?? 0;
  const periodSavingsPct = savingsRatePercent(incomeSum, expenseSum);

  if (!ready) {
    return <MonthSwipeSkeleton variant="stats" />;
  }

  return (
    <View style={styles.root}>
      <StrongText style={styles.sectionTitle}>By category</StrongText>
      <CategoryPieChart
        data={categories.data ?? []}
        type={pieType}
        centerTotal={pieType === 'expense' ? expenseSum : incomeSum}
        emptyLabel={
          pieType === 'expense'
            ? 'No expenses in this period.'
            : 'No income in this period.'
        }
      />
      <CaptionText
        style={[
          styles.savingsRate,
          { color: savingsRateColor(periodSavingsPct) },
        ]}
      >
        Savings rate{' '}
        {periodSavingsPct == null ? 'n/a' : `${periodSavingsPct}%`}
      </CaptionText>
      <View style={styles.quietPeers}>
        {(
          [
            { label: 'Spent', value: formatSigned(expenseSum) },
            { label: 'Earned', value: formatSigned(incomeSum) },
            { label: 'Net', value: formatSigned(netSum) },
          ] as const
        ).map((peer) => (
          <View key={peer.label} style={styles.quietPeer}>
            <CaptionText style={styles.quietPeerLabel}>{peer.label}</CaptionText>
            <StrongText style={styles.quietPeerValue}>{peer.value}</StrongText>
          </View>
        ))}
      </View>
      <CategoryBreakdownList data={categories.data ?? []} type={pieType} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: space.md,
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
  },
  quietPeers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.md,
  },
  quietPeer: {
    alignItems: 'center',
    gap: 2,
    minWidth: 72,
  },
  quietPeerLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  quietPeerValue: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
});
