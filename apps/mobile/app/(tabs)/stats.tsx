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
import { TrendLineChart } from '@/components/stats/TrendLineChart';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { trendStrokeForMetric } from '@/constants/chartColors';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
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
  ]);

  const personal = usePersonalStats(period, pieType);
  const showPair = scope === 'pair' && isPaired;
  const pairLive = showPair && !pairStatsBlocked;
  const aggregate = useAggregateStats(period, pieType, pairLive);
  const trend = usePersonalTrend(period, trendMetric, personal.bucket, timeZone);

  const totals = pairLive ? aggregate.totals : personal.totals;
  const categories = pairLive ? aggregate.categories : personal.categories;

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
  const isPeriodEmpty =
    !pairBlocked && !loading && !error && txnCount === 0;
  const expenseSum = totals.data?.expenseSum ?? 0;
  const incomeSum = totals.data?.incomeSum ?? 0;
  const netSum = totals.data?.net ?? 0;
  const periodSavingsPct = savingsRatePercent(incomeSum, expenseSum);

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
      />
    ),
    [timeZone, pieType, pairLive, formatSigned]
  );

  return (
    <View style={styles.container}>
    <OfflineBanner
      message={offline ? STATS_PERSONAL_OFFLINE_BANNER : null}
    />
    <MonthCardPager
      focus={focus}
      enabled={preset === 'month'}
      onStep={onMonthStep}
      renderAdjacent={renderAdjacent}
    >
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
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.green[700]}
        />
      }
    >
      {isPaired ? (
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
                style={[styles.scopeChip, selected && styles.scopeChipSelected]}
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
      ) : null}

      {pairLive ? (
        <CaptionText style={styles.pairHint}>
          Combined totals with {partnerLink.data?.partnerDisplayName ?? 'partner'}.
          Category sums only — no individual transactions.
        </CaptionText>
      ) : null}

      {pairBlocked ? (
        <ConnectionRequired message={STATS_OFFLINE_COPY} />
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.green[700]} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <TitleText style={styles.emptyTitle}>Couldn’t load stats</TitleText>
          <CaptionText style={styles.emptyBody}>{error}</CaptionText>
          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.secondaryPressed,
            ]}
            onPress={onRefresh}
          >
            <CaptionText style={styles.secondaryText}>Try again</CaptionText>
          </Pressable>
        </View>
      ) : isPeriodEmpty ? (
        <StatsEmptyState
          periodLabel={period.navLabel}
          preset={preset}
          onAddTransaction={() => guardedPush(router, ADD_TRANSACTION)}
          onGoToThisMonth={
            onCurrentMonthMonthly ? undefined : goToThisMonth
          }
        />
      ) : (
        <>
          <View style={styles.section}>
            <StrongText style={styles.sectionTitle}>By category</StrongText>
            <View style={styles.toggleRow}>
              {(['expense', 'income'] as const).map((t) => {
                const selected = pieType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setPieType(t)}
                    style={[styles.toggle, selected && styles.toggleSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <CaptionText
                      style={[
                        styles.toggleText,
                        selected && styles.toggleTextSelected,
                      ]}
                    >
                      {t === 'expense' ? 'Expenses' : 'Income'}
                    </CaptionText>
                  </Pressable>
                );
              })}
            </View>

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
              accessibilityLabel={
                periodSavingsPct == null
                  ? 'Savings rate not available'
                  : `Savings rate ${periodSavingsPct} percent`
              }
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
                  <CaptionText style={styles.quietPeerLabel}>
                    {peer.label}
                  </CaptionText>
                  <StrongText style={styles.quietPeerValue}>
                    {peer.value}
                  </StrongText>
                </View>
              ))}
            </View>

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
          </View>

          {!pairLive ? (
            <View style={styles.section}>
              <TitleText style={styles.trendTitle}>Trend</TitleText>
              <View style={styles.toggleRow}>
                {(
                  [
                    { value: 'expense', label: 'Expenses' },
                    { value: 'income', label: 'Income' },
                    { value: 'net', label: 'Net' },
                  ] as const
                ).map((opt) => {
                  const selected = trendMetric === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setTrendMetric(opt.value)}
                      style={[styles.toggle, selected && styles.toggleSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <CaptionText
                        style={[
                          styles.toggleText,
                          selected && styles.toggleTextSelected,
                        ]}
                      >
                        {opt.label}
                      </CaptionText>
                    </Pressable>
                  );
                })}
              </View>

              {trend.isLoading ? (
                <ActivityIndicator color={colors.green[700]} />
              ) : (
                /* Full-bleed: cancel content padding so Trend matches Planner Projection. */
                <View style={styles.chartBleed}>
                  <TrendLineChart
                    data={trend.data ?? []}
                    emptyLabel="No trend data for this period."
                    bucket={personal.bucket}
                    timeZone={timeZone}
                    strokeColor={trendStrokeForMetric(trendMetric)}
                  />
                </View>
              )}
            </View>
          ) : null}
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
  contentEmpty: {
    flexGrow: 1,
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
    marginTop: -space.sm,
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
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    justifyContent: 'center',
  },
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    minHeight: 36,
    justifyContent: 'center',
  },
  toggleSelected: {
    backgroundColor: colors.green[700],
  },
  toggleText: {
    color: colors.inkMuted,
    fontFamily: fonts.bodyStrong,
  },
  toggleTextSelected: {
    color: colors.inkInverse,
    fontFamily: fonts.bodyStrong,
  },
  savingsRate: {
    color: colors.inkMuted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    marginTop: -space.xs,
  },
  quietPeers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.md,
    paddingBottom: space.xs,
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
  /** Break out of `content` horizontal padding so the chart is edge-to-edge. */
  chartBleed: {
    marginHorizontal: -space.md,
    alignSelf: 'stretch',
  },
});
