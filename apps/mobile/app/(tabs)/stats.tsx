import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { CategoryBreakdownList } from '@/components/stats/CategoryBreakdownList';
import { CategoryPieChart } from '@/components/stats/CategoryPieChart';
import { PeriodSelector } from '@/components/stats/PeriodSelector';
import { TrendLineChart } from '@/components/stats/TrendLineChart';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import type { TransactionType } from '@/constants/categories';
import { trendStrokeForMetric } from '@/constants/chartColors';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { usePartnerLink } from '@/hooks/usePartner';
import {
  useAggregateStats,
  usePersonalStats,
  usePersonalTrend,
  type StatsScope,
} from '@/hooks/useStats';
import { useAuth } from '@/lib/auth';
import { formatUsd } from '@/lib/money';
import {
  currentPeriodFocus,
  resolvePeriodBounds,
  type PeriodFocus,
  type PeriodPreset,
} from '@/lib/periods';
import type { StatsMetric } from '@/lib/stats';

function formatMoney(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}${formatUsd(n)}`;
}

export default function StatsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const timeZone = profile?.timezone || 'UTC';
  const partnerLink = usePartnerLink();
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

  const personal = usePersonalStats(period, pieType);
  const aggregate = useAggregateStats(period, pieType, isPaired && scope === 'pair');
  const trend = usePersonalTrend(period, trendMetric, personal.bucket);

  const showPair = scope === 'pair' && isPaired;
  const totals = showPair ? aggregate.totals : personal.totals;
  const categories = showPair ? aggregate.categories : personal.categories;

  const refreshing =
    totals.isRefetching ||
    categories.isRefetching ||
    (!showPair && trend.isRefetching) ||
    partnerLink.isRefetching;
  const loading =
    partnerLink.isLoading ||
    totals.isLoading ||
    categories.isLoading;
  const error =
    (totals.error instanceof Error && totals.error.message) ||
    (categories.error instanceof Error && categories.error.message) ||
    (!showPair &&
      trend.error instanceof Error &&
      trend.error.message) ||
    null;

  const onRefresh = () => {
    void partnerLink.refetch();
    void totals.refetch();
    void categories.refetch();
    if (!showPair) {
      void trend.refetch();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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

      {showPair ? (
        <CaptionText style={styles.pairHint}>
          Combined totals with {partnerLink.data?.partnerDisplayName ?? 'partner'}.
          Category sums only — no individual transactions.
        </CaptionText>
      ) : null}

      <PeriodSelector
        preset={preset}
        navLabel={period.navLabel}
        focus={focus}
        timeZone={timeZone}
        customStart={customStart}
        customEnd={customEnd}
        onPresetChange={setPreset}
        onFocusChange={setFocus}
        onCustomStartChange={(date) => {
          setCustomStart(date);
          setCustomEnd((end) => (date.getTime() > end.getTime() ? date : end));
        }}
        onCustomEndChange={(date) => {
          setCustomEnd(date);
          setCustomStart((start) =>
            date.getTime() < start.getTime() ? date : start
          );
        }}
      />

      {loading ? (
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
      ) : (
        <>
          <View style={styles.totals}>
            <View style={styles.totalBlock}>
              <CaptionText style={styles.totalLabel}>Spent</CaptionText>
              <StrongText style={[styles.totalValue, { color: colors.expense }]}>
                {formatMoney(totals.data?.expenseSum ?? 0)}
              </StrongText>
            </View>
            <View style={styles.totalBlock}>
              <CaptionText style={styles.totalLabel}>Earned</CaptionText>
              <StrongText style={[styles.totalValue, { color: colors.income }]}>
                {formatMoney(totals.data?.incomeSum ?? 0)}
              </StrongText>
            </View>
            <View style={styles.totalBlock}>
              <CaptionText style={styles.totalLabel}>Net</CaptionText>
              <StrongText
                style={[
                  styles.totalValue,
                  {
                    color:
                      (totals.data?.net ?? 0) >= 0
                        ? colors.income
                        : colors.expense,
                  },
                ]}
              >
                {formatMoney(totals.data?.net ?? 0)}
              </StrongText>
            </View>
          </View>

          <View style={styles.section}>
            <TitleText style={styles.sectionTitle}>By category</TitleText>
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
              emptyLabel={
                pieType === 'expense'
                  ? 'No expenses in this period.'
                  : 'No income in this period.'
              }
            />

            <CategoryBreakdownList
              data={categories.data ?? []}
              type={pieType}
              onSelect={
                showPair
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

          {!showPair ? (
            <View style={styles.section}>
              <TitleText style={styles.sectionTitle}>Trend</TitleText>
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
                <TrendLineChart
                  data={trend.data ?? []}
                  emptyLabel="No trend data for this period."
                  strokeColor={trendStrokeForMetric(trendMetric)}
                />
              )}
              <CaptionText style={styles.hint}>
                Grouped by {personal.bucket}
                {trendMetric === 'expense'
                  ? ' · expenses'
                  : trendMetric === 'income'
                    ? ' · income'
                    : ' · net (income − expenses)'}
              </CaptionText>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.lg,
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
  totals: {
    flexDirection: 'row',
    gap: space.sm,
  },
  totalBlock: {
    flex: 1,
    gap: space.xs,
  },
  totalLabel: {
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  totalValue: {
    ...typography.amount,
    fontSize: 18,
    lineHeight: 24,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    color: colors.green[950],
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  toggle: {
    paddingHorizontal: space.sm + 4,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 36,
    justifyContent: 'center',
  },
  toggleSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.surface,
  },
  toggleText: {
    color: colors.inkMuted,
  },
  toggleTextSelected: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  hint: {
    color: colors.inkMuted,
  },
});
