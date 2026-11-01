import { useNavigation, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { ConnectionRequired } from '@/components/ConnectionRequired';
import { MonthCardPager } from '@/components/MonthCardPager';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import { CategoryBreakdownList } from '@/components/stats/CategoryBreakdownList';
import { CategoryPieChart } from '@/components/stats/CategoryPieChart';
import { PeriodSelector } from '@/components/stats/PeriodSelector';
import { StatsEmptyState } from '@/components/stats/StatsEmptyState';
import { StatsMonthPeek } from '@/components/stats/StatsMonthPeek';
import { StatsQuietPeers } from '@/components/stats/StatsQuietPeers';
import {
  PIE_TYPE_OPTIONS,
  StatsSegmentToggle,
  TREND_METRIC_OPTIONS,
} from '@/components/stats/StatsSegmentToggle';
import { StatsTrendPlaceholder } from '@/components/stats/StatsTrendPlaceholder';
import { TrendLineChart } from '@/components/stats/TrendLineChart';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { trendStrokeForMetric } from '@/constants/chartColors';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { usePrefetchAdjacentStatsMonths } from '@/hooks/useMonthPrefetch';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { usePartnerLink } from '@/hooks/usePartner';
import {
  useAggregateStats,
  usePersonalStats,
  usePersonalTrend,
  type StatsScope,
} from '@/hooks/useStats';
import { useAuth } from '@/lib/auth';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { guardedPush } from '@/lib/navGuard';
import {
  PeriodNavHeader,
  periodNavScreenOptions,
} from '@/lib/periodHeader';
import {
  currentPeriodFocus,
  resolvePeriodBounds,
  shiftPeriodFocus,
  type PeriodFocus,
  type PeriodPreset,
} from '@/lib/periods';
import {
  STATS_OFFLINE_COPY,
  STATS_PERSONAL_OFFLINE_BANNER,
} from '@/lib/offline/ux';
import { savingsRateColor, savingsRatePercent } from '@/lib/savingsRate';
import type { StatsMetric } from '@/lib/stats';

const ADD_TRANSACTION = '/transaction/new';

export default function StatsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { formatWhole } = useFormatMoney();
  const formatSigned = useCallback(
    (n: number): string => {
      const sign = n < 0 ? '−' : '';
      return `${sign}${formatWhole(Math.abs(n))}`;
    },
    [formatWhole]
  );
  const timeZone = profile?.timezone || 'UTC';
  const partnerLink = usePartnerLink();
  const { offline, pairStatsBlocked } = useOfflineGates();
  const isPaired = partnerLink.data?.status === 'active';

  const [scope, setScope] = useState<StatsScope>('personal');
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [focus, setFocus] = useState<PeriodFocus>(() =>
    currentPeriodFocus(timeZone)
  );
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [customEnd, setCustomEnd] = useState(() => new Date());
  const [pieType, setPieType] = useState<TransactionType>('expense');
  const [trendMetric, setTrendMetric] = useState<StatsMetric>('expense');
  const { edges, scrollProps } = useScrollEdges();

  // Shared with PeriodSelector so the header month tracks the card swipe.
  const swipeTranslateX = useSharedValue(0);
  const swipePagerWidth = useSharedValue(0);

  // Unlink → Pair scope disappears immediately; fall back to personal.
  useEffect(() => {
    if (!isPaired && scope === 'pair') {
      setScope('personal');
    }
  }, [isPaired, scope]);

  const period = useMemo(
    () =>
      resolvePeriodBounds(preset, timeZone, {
        focus,
        customStart: preset === 'custom' ? customStart : undefined,
        customEndInclusive: preset === 'custom' ? customEnd : undefined,
      }),
    [preset, timeZone, focus, customStart, customEnd]
  );

  const prevMonthFocus = useMemo(
    () => shiftPeriodFocus(focus, 'month', -1),
    [focus.year, focus.month]
  );
  const nextMonthFocus = useMemo(
    () => shiftPeriodFocus(focus, 'month', 1),
    [focus.year, focus.month]
  );
  const prevNavLabel = useMemo(
    () =>
      resolvePeriodBounds('month', timeZone, { focus: prevMonthFocus }).navLabel,
    [timeZone, prevMonthFocus.year, prevMonthFocus.month]
  );
  const nextNavLabel = useMemo(
    () =>
      resolvePeriodBounds('month', timeZone, { focus: nextMonthFocus }).navLabel,
    [timeZone, nextMonthFocus.year, nextMonthFocus.month]
  );

  const swipeMotion = useMemo(
    () =>
      preset === 'month'
        ? {
            translateX: swipeTranslateX,
            pagerWidth: swipePagerWidth,
            prevLabel: prevNavLabel,
            nextLabel: nextNavLabel,
          }
        : null,
    [
      preset,
      swipeTranslateX,
      swipePagerWidth,
      prevNavLabel,
      nextNavLabel,
    ]
  );

  useLayoutEffect(() => {
    navigation.setOptions(
      periodNavScreenOptions(() => (
        <PeriodNavHeader>
          <PeriodSelector
            preset={preset}
            navLabel={period.navLabel}
            focus={focus}
            timeZone={timeZone}
            customStart={customStart}
            customEnd={customEnd}
            showModeMenu
            swipeMotion={swipeMotion}
            onPresetChange={setPreset}
            onFocusChange={setFocus}
            onCustomStartChange={(date) => {
              setCustomStart(date);
              setCustomEnd((end) =>
                date.getTime() > end.getTime() ? date : end
              );
            }}
            onCustomEndChange={(date) => {
              setCustomEnd(date);
              setCustomStart((start) =>
                date.getTime() < start.getTime() ? date : start
              );
            }}
          />
        </PeriodNavHeader>
      ))
    );
  }, [
    navigation,
    preset,
    period.navLabel,
    focus,
    timeZone,
    customStart,
    customEnd,
    swipeMotion,
  ]);

  const personal = usePersonalStats(period, pieType);
  const showPair = scope === 'pair' && isPaired;
  const pairLive = showPair && !pairStatsBlocked;
  const aggregate = useAggregateStats(period, pieType, pairLive);
  const trend = usePersonalTrend(period, trendMetric, personal.bucket, timeZone);

  const totals = pairLive ? aggregate.totals : personal.totals;
  const categories = pairLive ? aggregate.categories : personal.categories;

  // Warm M−1 / M+1 so peeks and settle hit cache (no previous-month flash).
  usePrefetchAdjacentStatsMonths({
    focus,
    timeZone,
    pieType,
    pairLive,
    trendMetric,
    enabled: preset === 'month',
  });

  const refreshing =
    totals.isRefetching ||
    categories.isRefetching ||
    (!pairLive && trend.isRefetching) ||
    (!offline && partnerLink.isRefetching);
  const pairBlocked = showPair && pairStatsBlocked;
  // Partner RPC hangs offline after cold boot — never gate personal charts on it.
  const loading = pairBlocked
    ? false
    : totals.isLoading ||
      categories.isLoading ||
      (!offline && partnerLink.isLoading);
  // Never paint charts from a missing totals payload (wrong-month / empty flash).
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
  /** Confirmed zero txns for the period (ignore partner-link spinner). */
  const isPeriodEmpty =
    !pairBlocked &&
    !error &&
    totalsReady &&
    !totals.isLoading &&
    txnCount === 0;
  /** Totals still in flight — Quiet month on Monthly; spinner elsewhere. */
  const awaitingTotals =
    !pairBlocked && !error && (!totalsReady || totals.isLoading);
  /**
   * Totals say this month has activity — paint the By-category shell (with a
   * reserved Spent/Earned/Net row) even while categories are still loading.
   */
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

  // Fresh each render so midnight / timezone wall-clock stays correct.
  const currentFocus = currentPeriodFocus(timeZone);
  /** Already on current calendar month in Monthly — omit secondary CTA. */
  const onCurrentMonthMonthly =
    preset === 'month' &&
    focus.year === currentFocus.year &&
    focus.month === currentFocus.month;

  const onRefresh = () => {
    if (!offline) {
      void partnerLink.refetch();
    }
    if (showPair && pairStatsBlocked) return;
    void totals.refetch();
    void categories.refetch();
    if (!pairLive) {
      void trend.refetch();
    }
  };

  const goToThisMonth = () => {
    setPreset('month');
    setFocus(currentPeriodFocus(timeZone));
  };

  const onMonthStep = useCallback((delta: -1 | 1) => {
    setFocus((current) => shiftPeriodFocus(current, 'month', delta));
  }, []);

  const renderAdjacent = useCallback(
    (adjacentFocus: PeriodFocus) => (
      <StatsMonthPeek
        focus={adjacentFocus}
        timeZone={timeZone}
        pieType={pieType}
        pairLive={pairLive}
        formatSigned={formatSigned}
        /** Tabs live in stable chrome above the pager on Monthly. */
        showSectionChrome={false}
      />
    ),
    [timeZone, pieType, pairLive, formatSigned]
  );

  /** Monthly: keep By-category title + tabs above the sliding cards (no CLS). */
  const monthlyChromeOutside =
    preset === 'month' && !pairBlocked && !error;

  const byCategoryChrome = (placement: 'outside' | 'inside') => (
    <View
      style={
        placement === 'outside' ? styles.sectionChrome : styles.section
      }
    >
      <StrongText style={styles.sectionTitle}>By category</StrongText>
      <StatsSegmentToggle
        options={PIE_TYPE_OPTIONS}
        value={pieType}
        onChange={setPieType}
        accessibilityLabel="Category type"
      />
    </View>
  );

  const trendBlock =
    !pairLive && !pairBlocked && !error ? (
      <View style={styles.section}>
        <TitleText style={styles.trendTitle}>Trend</TitleText>
        <StatsSegmentToggle
          options={TREND_METRIC_OPTIONS}
          value={trendMetric}
          onChange={setTrendMetric}
          accessibilityLabel="Trend metric"
        />
        {trend.isLoading || trend.data == null ? (
          <View style={styles.chartBleed}>
            <StatsTrendPlaceholder />
          </View>
        ) : (
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
            pairLive
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
        <View
          style={styles.listPlaceholder}
          accessibilityLabel="Loading categories"
        >
          <View style={styles.listBone} />
          <View style={[styles.listBone, styles.listBoneMid]} />
          <View style={[styles.listBone, styles.listBoneShort]} />
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <OfflineBanner
        message={offline ? STATS_PERSONAL_OFFLINE_BANNER : null}
      />

      {isPaired ? (
        <View style={styles.scopeRowPad}>
          <View style={styles.scopeRow}>
            {(
              [
                { value: 'personal', label: 'Personal' },
                { value: 'pair', label: 'Pair' },
              ] as const
            ).map((opt) => {
              const selected = scope === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setScope(opt.value)}
                  style={[
                    styles.scopeChip,
                    selected && styles.scopeChipSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${opt.label} stats`}
                >
                  <CaptionText
                    style={[
                      styles.scopeText,
                      selected && styles.scopeTextSelected,
                    ]}
                  >
                    {opt.label}
                  </CaptionText>
                </Pressable>
              );
            })}
          </View>
          {pairLive ? (
            <CaptionText style={styles.pairHint}>
              Combined totals with{' '}
              {partnerLink.data?.partnerDisplayName ?? 'partner'}. Category sums
              only — no individual transactions.
            </CaptionText>
          ) : null}
        </View>
      ) : null}

      {monthlyChromeOutside ? byCategoryChrome('outside') : null}

      <MonthCardPager
        focus={focus}
        enabled={preset === 'month'}
        onStep={onMonthStep}
        renderAdjacent={renderAdjacent}
        translateX={swipeTranslateX}
        pagerWidth={swipePagerWidth}
      >
        <ScrollEdgeHost edges={edges} style={styles.scrollHost}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              (isPeriodEmpty || (awaitingTotals && preset === 'month')) &&
                styles.contentEmpty,
              monthlyChromeOutside && styles.contentBelowChrome,
            ]}
            {...scrollProps}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.green[700]}
              />
            }
          >
            {pairBlocked ? (
              <ConnectionRequired message={STATS_OFFLINE_COPY} />
            ) : error ? (
              <View style={styles.centered}>
                <TitleText style={styles.emptyTitle}>
                  Couldn’t load stats
                </TitleText>
                <CaptionText style={styles.emptyBody}>{error}</CaptionText>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondary,
                    pressed && styles.secondaryPressed,
                  ]}
                  onPress={onRefresh}
                >
                  <CaptionText style={styles.secondaryText}>
                    Try again
                  </CaptionText>
                </Pressable>
              </View>
            ) : (
              <>
                {!monthlyChromeOutside ? byCategoryChrome('inside') : null}

                {awaitingTotals && preset === 'month' ? (
                  <StatsEmptyState
                    periodLabel={period.navLabel}
                    preset={preset}
                    interactive={false}
                  />
                ) : isPeriodEmpty ? (
                  <StatsEmptyState
                    periodLabel={period.navLabel}
                    preset={preset}
                    onAddTransaction={() =>
                      guardedPush(router, ADD_TRANSACTION)
                    }
                    onGoToThisMonth={
                      onCurrentMonthMonthly ? undefined : goToThisMonth
                    }
                  />
                ) : awaitingTotals || (loading && !knownActiveMonth) ? (
                  <View style={styles.centered}>
                    <ActivityIndicator
                      size="large"
                      color={colors.green[700]}
                    />
                  </View>
                ) : (
                  <View style={styles.section}>{categoryBody}</View>
                )}

                {trendBlock}
              </>
            )}
          </ScrollView>
        </ScrollEdgeHost>
      </MonthCardPager>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
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
  contentBelowChrome: {
    // Section chrome above the pager already padded the top.
    paddingTop: space.sm,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  scopeRowPad: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: space.sm,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  scopeChip: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.surface,
  },
  scopeText: {
    color: colors.inkMuted,
  },
  scopeTextSelected: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  pairHint: {
    color: colors.inkMuted,
  },
  sectionChrome: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.sm,
    backgroundColor: colors.canvas,
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
  listPlaceholder: {
    gap: space.sm,
    minHeight: 72,
  },
  listBone: {
    height: 14,
    width: '100%',
    borderRadius: radius.sm / 2,
    backgroundColor: colors.surfaceMuted,
  },
  listBoneMid: {
    width: '78%',
  },
  listBoneShort: {
    width: '56%',
  },
  /** Break out of `content` horizontal padding so the chart is edge-to-edge. */
  chartBleed: {
    marginHorizontal: -space.md,
    alignSelf: 'stretch',
  },
});
