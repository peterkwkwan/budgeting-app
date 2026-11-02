import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ConnectionRequired } from '@/components/ConnectionRequired';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import { CategoryBreakdownList } from '@/components/stats/CategoryBreakdownList';
import { CategoryListSkeleton } from '@/components/stats/CategoryListSkeleton';
import { CategoryPieChart } from '@/components/stats/CategoryPieChart';
import { StatsEmptyState } from '@/components/stats/StatsEmptyState';
import { StatsQuietPeers } from '@/components/stats/StatsQuietPeers';
import {
  PIE_TYPE_OPTIONS,
  StatsSegmentToggle,
  TREND_METRIC_OPTIONS,
} from '@/components/stats/StatsSegmentToggle';
import { TrendLineChart } from '@/components/stats/TrendLineChart';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { trendStrokeForMetric } from '@/constants/chartColors';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import {
  useAggregateStats,
  usePersonalStats,
  usePersonalTrend,
} from '@/hooks/useStats';
import { guardedPush } from '@/lib/navGuard';
import { STATS_OFFLINE_COPY } from '@/lib/offline/ux';
import {
  currentPeriodFocus,
  resolvePeriodBounds,
  type PeriodFocus,
  type PeriodPreset,
} from '@/lib/periods';
import { savingsRateColor, savingsRatePercent } from '@/lib/savingsRate';
import type { StatsMetric } from '@/lib/stats';

const ADD_TRANSACTION = '/transaction/new';

export type StatsMonthBodyProps = {
  focus: PeriodFocus;
  /** Non-month presets still reuse this body when the pager is disabled. */
  preset: PeriodPreset;
  timeZone: string;
  pieType: TransactionType;
  onPieTypeChange: (type: TransactionType) => void;
  trendMetric: StatsMetric;
  onTrendMetricChange: (metric: StatsMetric) => void;
  pairLive: boolean;
  pairBlocked: boolean;
  offline: boolean;
  partnerRefetching: boolean;
  partnerLoading: boolean;
  onPartnerRefetch: () => void;
  formatSigned: (n: number) => string;
  /** Current (center) slot — refresh + CTAs + category drill-down. */
  active: boolean;
  onGoToThisMonth: () => void;
  customStart?: Date;
  customEnd?: Date;
};

/**
 * Full Stats period UI for one focus (month card or non-month settled view).
 * Used for prev / current / next Monthly slots so settle never swaps trees.
 */
export function StatsMonthBody({
  focus,
  preset,
  timeZone,
  pieType,
  onPieTypeChange,
  trendMetric,
  onTrendMetricChange,
  pairLive,
  pairBlocked,
  offline,
  partnerRefetching,
  partnerLoading,
  onPartnerRefetch,
  formatSigned,
  active,
  onGoToThisMonth,
  customStart,
  customEnd,
}: StatsMonthBodyProps) {
  const router = useRouter();
  const { edges, scrollProps } = useScrollEdges();

  const period = useMemo(
    () =>
      resolvePeriodBounds(preset, timeZone, {
        focus,
        customStart: preset === 'custom' ? customStart : undefined,
        customEndInclusive: preset === 'custom' ? customEnd : undefined,
      }),
    [preset, timeZone, focus, customStart, customEnd]
  );

  const personal = usePersonalStats(period, pieType);
  const aggregate = useAggregateStats(period, pieType, pairLive);
  const trend = usePersonalTrend(period, trendMetric, personal.bucket, timeZone);

  const totals = pairLive ? aggregate.totals : personal.totals;
  const categories = pairLive ? aggregate.categories : personal.categories;

  const refreshing =
    totals.isRefetching ||
    categories.isRefetching ||
    (!pairLive && trend.isRefetching) ||
    (!offline && partnerRefetching);

  const loading = pairBlocked
    ? false
    : totals.isLoading ||
      categories.isLoading ||
      (!offline && partnerLoading);

  const totalsReady = totals.data != null;
  const error = pairBlocked
    ? null
    : (totals.error instanceof Error && totals.error.message) ||
      (categories.error instanceof Error && categories.error.message) ||
      (!pairLive &&
        trend.error instanceof Error &&
        trend.error.message) ||
      null;

  const txnCount =
    (totals.data?.expenseCount ?? 0) + (totals.data?.incomeCount ?? 0);
  const categoriesReady = !categories.isLoading;
  const isPeriodEmpty =
    !pairBlocked &&
    !error &&
    totalsReady &&
    !totals.isLoading &&
    txnCount === 0;
  const awaitingTotals =
    !pairBlocked && !error && (!totalsReady || totals.isLoading);
  const knownActiveMonth =
    preset === 'month' &&
    !pairBlocked &&
    !error &&
    totalsReady &&
    !totals.isLoading &&
    txnCount > 0;

  const expenseSum = totals.data?.expenseSum ?? 0;
  const incomeSum = totals.data?.incomeSum ?? 0;
  const netSum = totals.data?.net ?? 0;
  const periodSavingsPct = savingsRatePercent(incomeSum, expenseSum);
  const quietPeers = [
    { label: 'Spent', value: formatSigned(expenseSum) },
    { label: 'Earned', value: formatSigned(incomeSum) },
    { label: 'Net', value: formatSigned(netSum) },
  ] as const;

  const currentFocus = currentPeriodFocus(timeZone);
  const onCurrentMonthMonthly =
    preset === 'month' &&
    focus.year === currentFocus.year &&
    focus.month === currentFocus.month;

  const onRefresh = () => {
    if (!active) return;
    if (!offline) {
      onPartnerRefetch();
    }
    if (pairBlocked) return;
    void totals.refetch();
    void categories.refetch();
    if (!pairLive) {
      void trend.refetch();
    }
  };

  /**
   * Quiet / empty periods: hide Trend entirely (no title, toggles, or chart).
   * Active periods keep the section even while the series is still loading.
   */
  const showTrend =
    !pairLive &&
    !pairBlocked &&
    !error &&
    !isPeriodEmpty &&
    !awaitingTotals;

  const byCategoryChrome = (
    <View style={styles.section}>
      <StrongText style={styles.sectionTitle}>By category</StrongText>
      <StatsSegmentToggle
        options={PIE_TYPE_OPTIONS}
        value={pieType}
        onChange={active ? onPieTypeChange : undefined}
        readOnly={!active}
        accessibilityLabel="Category type"
      />
    </View>
  );

  const trendBlock = showTrend ? (
    <View style={styles.section}>
      <TitleText style={styles.trendTitle}>Trend</TitleText>
      <StatsSegmentToggle
        options={TREND_METRIC_OPTIONS}
        value={trendMetric}
        onChange={active ? onTrendMetricChange : undefined}
        readOnly={!active}
        accessibilityLabel="Trend metric"
      />
      {trend.isLoading || trend.data == null ? null : (
        <View style={styles.chartBleed}>
          <TrendLineChart
            data={trend.data}
            emptyLabel="No trend data for this period."
            bucket={personal.bucket}
            timeZone={timeZone}
            strokeColor={trendStrokeForMetric(trendMetric)}
          />
        </View>
      )}
    </View>
  ) : null;

  const categoryBody = (
    <>
      <CategoryPieChart
        data={categoriesReady ? (categories.data ?? []) : []}
        type={pieType}
        centerTotal={pieType === 'expense' ? expenseSum : incomeSum}
        loading={!categoriesReady}
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
        accessibilityLabel={
          periodSavingsPct == null
            ? 'Savings rate not available'
            : `Savings rate ${periodSavingsPct} percent`
        }
      >
        Savings rate{' '}
        {periodSavingsPct == null ? 'n/a' : `${periodSavingsPct}%`}
      </CaptionText>

      <StatsQuietPeers peers={quietPeers} placeholder={!totalsReady} />

      {categoriesReady ? (
        <CategoryBreakdownList
          data={categories.data ?? []}
          type={pieType}
          onSelect={
            !active || pairLive
              ? undefined
              : (row) => {
                  router.push({
                    pathname: '/stats/category',
                    params: {
                      category: row.category,
                      type: row.type,
                      start: period.start.toISOString(),
                      end: period.end.toISOString(),
                      periodLabel: period.label,
                    },
                  });
                }
          }
        />
      ) : (
        <CategoryListSkeleton />
      )}
    </>
  );

  return (
    <ScrollEdgeHost edges={edges} style={styles.scrollHost}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          isPeriodEmpty && styles.contentEmpty,
        ]}
        {...scrollProps}
        refreshControl={
          <RefreshControl
            refreshing={active && refreshing}
            onRefresh={onRefresh}
            tintColor={colors.green[700]}
          />
        }
      >
        {pairBlocked ? (
          <ConnectionRequired message={STATS_OFFLINE_COPY} />
        ) : error ? (
          <View style={styles.centered}>
            <TitleText style={styles.emptyTitle}>Couldn’t load stats</TitleText>
            <CaptionText style={styles.emptyBody}>{error}</CaptionText>
            {active ? (
              <Pressable
                style={({ pressed }) => [
                  styles.secondary,
                  pressed && styles.secondaryPressed,
                ]}
                onPress={onRefresh}
              >
                <CaptionText style={styles.secondaryText}>Try again</CaptionText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            {isPeriodEmpty ? (
              <StatsEmptyState
                periodLabel={period.navLabel}
                preset={preset}
                // Same Quiet chrome on all slots (pager disables adjacent hits).
                onAddTransaction={() =>
                  guardedPush(router, ADD_TRANSACTION)
                }
                onGoToThisMonth={
                  onCurrentMonthMonthly ? undefined : onGoToThisMonth
                }
              />
            ) : preset === 'month' ||
              knownActiveMonth ||
              !(awaitingTotals || loading) ? (
              <>
                {byCategoryChrome}
                <View style={styles.section}>{categoryBody}</View>
              </>
            ) : (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.green[700]} />
              </View>
            )}

            {trendBlock}
          </>
        )}
      </ScrollView>
    </ScrollEdgeHost>
  );
}

const styles = StyleSheet.create({
  scrollHost: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  centered: {
    paddingVertical: space.xxl,
    alignItems: 'center',
    gap: space.sm,
  },
  emptyTitle: {
    color: colors.green[950],
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.inkMuted,
    textAlign: 'center',
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  secondary: {
    marginTop: space.sm,
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  secondaryText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
  },
  trendTitle: {
    color: colors.ink,
  },
  savingsRate: {
    color: colors.inkMuted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    marginTop: -space.xs,
  },
  /** Break out of `content` horizontal padding so the chart is edge-to-edge. */
  chartBleed: {
    marginHorizontal: -space.md,
    alignSelf: 'stretch',
  },
});
