import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryBreakdownList } from '@/components/stats/CategoryBreakdownList';
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
  /**
   * When false, omit By-category title + Expenses|Income tabs — Monthly
   * Stats keeps that chrome stable above MonthCardPager. Default true for
   * standalone use.
   */
  showSectionChrome?: boolean;
};

/**
 * Non-interactive adjacent-month peek for Stats (Monthly).
 * Quiet-month empty UI while totals are unknown/empty; once totals show
 * activity, paint the shell with a reserved Spent/Earned/Net row even if
 * categories are still loading (avoids CLS when the list arrives).
 */
export function StatsMonthPeek({
  focus,
  timeZone,
  pieType,
  pairLive,
  formatSigned,
  showSectionChrome = true,
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

  const chrome = showSectionChrome ? (
    <>
      <StrongText style={styles.sectionTitle}>By category</StrongText>
      <StatsSegmentToggle
        options={PIE_TYPE_OPTIONS}
        value={pieType}
        readOnly
        accessibilityLabel="Category type"
      />
    </>
  ) : null;

  // Unknown / empty → Quiet month (tabs reserved above when chrome shown).
  if (!totalsReady || knownEmpty) {
    return (
      <View style={styles.emptyRoot}>
        {chrome}
        <StatsEmptyState
          periodLabel={period.navLabel}
          preset="month"
          interactive={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {chrome}
      <CategoryPieChart
        data={categoriesReady ? (categories.data ?? []) : []}
        type={pieType}
        centerTotal={pieType === 'expense' ? expenseSum : incomeSum}
        emptyLabel={
          categoriesReady
            ? pieType === 'expense'
              ? 'No expenses in this period.'
              : 'No income in this period.'
            : 'Loading categories…'
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
      <StatsQuietPeers peers={peers} />
      {categoriesReady ? (
        <CategoryBreakdownList data={categories.data ?? []} type={pieType} />
      ) : (
        <View style={styles.listPlaceholder} accessibilityLabel="Loading categories">
          <View style={styles.listBone} />
          <View style={[styles.listBone, styles.listBoneMid]} />
          <View style={[styles.listBone, styles.listBoneShort]} />
        </View>
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
  listPlaceholder: {
    gap: space.sm,
    minHeight: 72,
  },
  listBone: {
    height: 14,
    width: '100%',
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
  },
  listBoneMid: {
    width: '78%',
  },
  listBoneShort: {
    width: '56%',
  },
});
