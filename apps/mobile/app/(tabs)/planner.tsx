import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { PlusIcon } from '@/components/icons';
import { LinkedAccountLinks } from '@/components/planner/LinkedAccountLinks';
import { ProjectionChart } from '@/components/planner/ProjectionChart';
import { ProjectionDisclaimerInfo } from '@/components/planner/ProjectionDisclaimerInfo';
import { ProjectionEmptyWell } from '@/components/planner/ProjectionEmptyWell';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import {
  GOAL_TYPE_LABELS,
  HORIZON_PRESETS,
  PLAN_CADENCE_LABELS,
  VEHICLE_TYPE_LABELS,
  type HorizonPresetKey,
} from '@/constants/planner';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import {
  usePlannerGoals,
  usePlannerVehicles,
} from '@/hooks/usePlanner';
import {
  type ChartFocusSelection,
  isChartableGoal,
  linkedGrowthVehicles,
  loadChartFocus,
  resolveChartFocus,
  resolveChartMode,
  saveChartFocus,
} from '@/lib/plannerChartFocus';
import { formatUsd } from '@/lib/money';
import { guardedPush } from '@/lib/navGuard';
import {
  goalEffectiveSaved,
  goalPace,
  projectNetWorth,
  requiredContribution,
  type PaceStatus,
  type ProjectVehicleInput,
} from '@/lib/plannerMath';
import type { PlannerVehicle } from '@/lib/plannerVehicles';

/** Near-white empty fill — lighter than surfaceMuted (#f5f5f7). */
const EMPTY_FILL = '#fafafa';

const ADD_VEHICLE = '/planner/vehicle/new';
const ADD_GOAL = '/planner/goal/new';

function paceLabel(status: PaceStatus): string {
  switch (status) {
    case 'ahead':
      return 'Ahead';
    case 'behind':
      return 'Behind';
    case 'on_track':
      return 'On track';
    default:
      return 'No date';
  }
}

function paceColor(status: PaceStatus): string {
  switch (status) {
    case 'ahead':
      return colors.green[700];
    case 'behind':
      return colors.warning;
    case 'on_track':
      return colors.ink;
    default:
      return colors.inkMuted;
  }
}

function toProjectInput(v: PlannerVehicle): ProjectVehicleInput {
  return {
    balance: v.balance,
    annualRatePercent: v.annual_rate,
    growthMode: v.growth_mode,
    compoundPeriod: v.compound_period,
    planAmount: v.plan_amount,
    planCadence: v.plan_cadence,
  };
}

export default function PlannerScreen() {
  const router = useRouter();
  const vehicles = usePlannerVehicles();
  const goals = usePlannerGoals();

  const [horizonKey, setHorizonKey] = useState<HorizonPresetKey>('10y');
  const [customYears, setCustomYears] = useState('15');
  const [storedFocus, setStoredFocus] = useState<ChartFocusSelection | null>(
    null
  );
  const [prefsReady, setPrefsReady] = useState(false);
  const { edges, scrollProps } = useScrollEdges();

  useEffect(() => {
    let cancelled = false;
    void loadChartFocus().then((sel) => {
      if (!cancelled) {
        setStoredFocus(sel);
        setPrefsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const horizonMonths = useMemo(() => {
    if (horizonKey === 'custom') {
      const y = Number(customYears);
      if (!(y > 0) || Number.isNaN(y)) return 120;
      return Math.min(600, Math.round(y * 12));
    }
    return (
      HORIZON_PRESETS.find((h) => h.key === horizonKey)?.months ?? 120
    );
  }, [horizonKey, customYears]);

  const vehicleList = vehicles.data ?? [];
  const goalList = goals.data ?? [];

  const chartMode = useMemo(
    () => resolveChartMode(goalList, vehicleList),
    [goalList, vehicleList]
  );

  const focus = useMemo(
    () =>
      resolveChartFocus({
        mode: chartMode,
        goals: goalList,
        vehicles: vehicleList,
        stored: storedFocus,
      }),
    [chartMode, goalList, vehicleList, storedFocus]
  );

  const focusedGoal = useMemo(() => {
    if (focus?.kind !== 'goal') return null;
    return goalList.find((g) => g.id === focus.id) ?? null;
  }, [focus, goalList]);

  const primaryVehicles = useMemo(() => {
    if (!focus) return [] as PlannerVehicle[];
    if (focus.kind === 'goal' && focusedGoal) {
      return linkedGrowthVehicles(focusedGoal, vehicleList);
    }
    if (focus.kind === 'vehicle') {
      const v = vehicleList.find((x) => x.id === focus.id);
      return v ? [v] : [];
    }
    return [];
  }, [focus, focusedGoal, vehicleList]);

  const projection = useMemo(() => {
    if (primaryVehicles.length === 0) return [];
    return projectNetWorth(
      primaryVehicles.map(toProjectInput),
      horizonMonths
    );
  }, [primaryVehicles, horizonMonths]);

  const targetAmount =
    chartMode === 'goal' && focusedGoal != null
      ? focusedGoal.target_amount
      : null;

  const refreshing = vehicles.isRefetching || goals.isRefetching;
  const loading = vehicles.isLoading || goals.isLoading || !prefsReady;
  const error =
    (vehicles.error instanceof Error && vehicles.error.message) ||
    (goals.error instanceof Error && goals.error.message) ||
    null;

  const hasVehicles = vehicleList.length > 0;
  const hasGoals = goalList.length > 0;
  const endNet = projection[projection.length - 1]?.netWorth ?? 0;
  const startNet = projection[0]?.netWorth ?? 0;
  const hasGreyedGoals =
    chartMode === 'goal' &&
    goalList.some((g) => !isChartableGoal(g, vehicleList));

  function selectFocus(next: ChartFocusSelection) {
    setStoredFocus(next);
    void saveChartFocus(next);
  }

  return (
    <ScrollEdgeHost edges={edges} style={styles.container}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      {...scrollProps}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void vehicles.refetch();
            void goals.refetch();
          }}
          tintColor={colors.green[700]}
        />
      }
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.green[700]} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <TitleText style={styles.sectionTitle}>Couldn’t load planner</TitleText>
          <CaptionText style={styles.muted}>{error}</CaptionText>
          <Pressable
            style={styles.secondary}
            onPress={() => {
              void vehicles.refetch();
              void goals.refetch();
            }}
          >
            <CaptionText style={styles.secondaryText}>Try again</CaptionText>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.sectionHead, styles.sectionHeadFirst]}>
            <View style={styles.projectionTitleRow}>
              <TitleText style={styles.sectionTitle}>Projection</TitleText>
              <ProjectionDisclaimerInfo />
            </View>
          </View>

          <View style={styles.chips}>
            {HORIZON_PRESETS.map((h) => (
              <Pressable
                key={h.key}
                style={[
                  styles.chip,
                  horizonKey === h.key && styles.chipSelected,
                ]}
                onPress={() => setHorizonKey(h.key)}
              >
                <CaptionText
                  style={[
                    styles.chipText,
                    horizonKey === h.key && styles.chipTextSelected,
                  ]}
                >
                  {h.label}
                </CaptionText>
              </Pressable>
            ))}
          </View>
          {horizonKey === 'custom' ? (
            <View style={styles.customRow}>
              <CaptionText style={styles.muted}>Years</CaptionText>
              <TextInput
                style={styles.customInput}
                value={customYears}
                onChangeText={setCustomYears}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          ) : null}

          {hasVehicles ? (
            <View style={styles.showBlock}>
              <CaptionText style={styles.showLabel}>Show</CaptionText>
              <View style={styles.chips}>
                {chartMode === 'goal'
                  ? goalList.map((g) => {
                      const chartable = isChartableGoal(g, vehicleList);
                      const selected =
                        focus?.kind === 'goal' && focus.id === g.id;
                      return (
                        <Pressable
                          key={g.id}
                          disabled={!chartable}
                          style={[
                            styles.chip,
                            styles.showChip,
                            selected && styles.chipSelected,
                            !chartable && styles.chipDisabled,
                          ]}
                          onPress={() =>
                            selectFocus({ kind: 'goal', id: g.id })
                          }
                          accessibilityState={{
                            selected,
                            disabled: !chartable,
                          }}
                          accessibilityLabel={
                            chartable
                              ? `Show ${g.name}`
                              : `${g.name}, link a growth account to chart`
                          }
                        >
                          <CaptionText
                            style={[
                              styles.chipText,
                              selected && styles.chipTextSelected,
                              !chartable && styles.chipTextDisabled,
                            ]}
                            numberOfLines={1}
                          >
                            {g.name}
                          </CaptionText>
                        </Pressable>
                      );
                    })
                  : vehicleList.map((v) => {
                      const selected =
                        focus?.kind === 'vehicle' && focus.id === v.id;
                      return (
                        <Pressable
                          key={v.id}
                          style={[
                            styles.chip,
                            styles.showChip,
                            selected && styles.chipSelected,
                          ]}
                          onPress={() =>
                            selectFocus({ kind: 'vehicle', id: v.id })
                          }
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Show ${v.name}`}
                        >
                          <CaptionText
                            style={[
                              styles.chipText,
                              selected && styles.chipTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {v.name}
                          </CaptionText>
                        </Pressable>
                      );
                    })}
              </View>
              {hasGreyedGoals ? (
                <CaptionText style={styles.showHint}>
                  Greyed goals need a linked growth account (not debt).
                </CaptionText>
              ) : null}
            </View>
          ) : null}

          {!hasVehicles ? (
            <View style={styles.chartBleed}>
              <ProjectionEmptyWell
                onPress={() => guardedPush(router, ADD_VEHICLE)}
              />
            </View>
          ) : (
            <>
              {/* Full-bleed: cancel content padding so the chart well hits screen edges. */}
              <View style={styles.chartBleed}>
                <ProjectionChart
                  data={projection}
                  targetAmount={targetAmount}
                  emptyLabel="No projection yet"
                />
              </View>
              <View style={styles.summaryRow}>
                <View>
                  <CaptionText style={styles.muted}>Now</CaptionText>
                  <StrongText style={styles.amount}>
                    {formatUsd(startNet)}
                  </StrongText>
                </View>
                <View style={styles.summaryEnd}>
                  <CaptionText style={styles.muted}>At horizon</CaptionText>
                  <StrongText style={styles.amount}>
                    {formatUsd(endNet)}
                  </StrongText>
                </View>
              </View>
            </>
          )}

          <View style={styles.sectionHead}>
            <TitleText style={styles.sectionTitle}>Accounts</TitleText>
            {hasVehicles ? (
              <Pressable
                style={styles.headerAdd}
                onPress={() => guardedPush(router, ADD_VEHICLE)}
                accessibilityRole="button"
                accessibilityLabel="Add account"
              >
                <CaptionText style={styles.secondaryText}>
                  Add account
                </CaptionText>
              </Pressable>
            ) : null}
          </View>

          {!hasVehicles ? (
            <Pressable
              style={({ pressed }) => [
                styles.dashedEmpty,
                pressed && styles.dashedEmptyPressed,
              ]}
              onPress={() => guardedPush(router, ADD_VEHICLE)}
              accessibilityRole="button"
              accessibilityLabel="Add account"
            >
              <PlusIcon color={colors.green[700]} size={22} />
              <CaptionText style={styles.dashedBody}>
                Track savings, investments, cash, or debt with a rate and
                optional plan.
              </CaptionText>
              <CaptionText style={styles.secondaryText}>Add account</CaptionText>
            </Pressable>
          ) : (
            vehicleList.map((v) => {
              const detailHref = `/planner/vehicle/${v.id}`;
              return (
                <Pressable
                  key={v.id}
                  style={({ pressed }) => [
                    styles.plannerCard,
                    pressed && styles.plannerCardPressed,
                  ]}
                  onPress={() => guardedPush(router, detailHref)}
                  accessibilityRole="button"
                  accessibilityLabel={`${v.name} account`}
                >
                  <View style={styles.plannerCardTop}>
                    <StrongText style={styles.plannerCardTitle} numberOfLines={2}>
                      {v.name}
                    </StrongText>
                    <Pressable
                      onPress={() => guardedPush(router, detailHref)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${v.name}`}
                    >
                      <CaptionText style={styles.editLink}>Edit</CaptionText>
                    </Pressable>
                  </View>
                  <CaptionText style={styles.muted}>
                    {VEHICLE_TYPE_LABELS[v.vehicle_type]} ·{' '}
                    {v.growth_mode === 'grow' ? 'Grows' : 'Shrinks'} ·{' '}
                    {v.annual_rate}%{' '}
                    {v.compound_period === 'yearly' ? 'yearly' : 'monthly'}
                  </CaptionText>
                  <CaptionText style={styles.muted}>
                    {formatUsd(v.balance)}
                    {v.plan_amount != null && v.plan_cadence
                      ? ` · plan ${formatUsd(v.plan_amount)} ${PLAN_CADENCE_LABELS[v.plan_cadence].toLowerCase()}`
                      : ''}
                  </CaptionText>
                </Pressable>
              );
            })
          )}

          <View style={styles.sectionHead}>
            <TitleText style={styles.sectionTitle}>Goals</TitleText>
            {hasGoals ? (
              <Pressable
                style={styles.headerAdd}
                onPress={() => guardedPush(router, ADD_GOAL)}
                accessibilityRole="button"
                accessibilityLabel="Add goal"
              >
                <CaptionText style={styles.secondaryText}>Add goal</CaptionText>
              </Pressable>
            ) : null}
          </View>

          {!hasGoals ? (
            <Pressable
              style={({ pressed }) => [
                styles.dashedEmpty,
                pressed && styles.dashedEmptyPressed,
              ]}
              onPress={() => guardedPush(router, ADD_GOAL)}
              accessibilityRole="button"
              accessibilityLabel="Add goal"
            >
              <PlusIcon color={colors.green[700]} size={22} />
              <CaptionText style={styles.dashedBody}>
                No goals yet. Set a target amount and optional date to track
                pace.
              </CaptionText>
              {hasVehicles ? (
                <CaptionText style={styles.muted}>
                  Link accounts when you add a goal.
                </CaptionText>
              ) : null}
              <CaptionText style={styles.secondaryText}>Add goal</CaptionText>
            </Pressable>
          ) : (
            goalList.map((g) => {
              const saved = goalEffectiveSaved({
                currentSaved: g.current_saved,
                vehicleIds: g.vehicle_ids,
                vehicles: vehicleList,
              });
              const linkedGrowth = linkedGrowthVehicles(g, vehicleList);
              const pace = goalPace({
                targetAmount: g.target_amount,
                currentSaved: saved,
                targetDate: g.target_date,
                createdAt: g.created_at,
                linkedVehicles: linkedGrowth.map(toProjectInput),
                planAmount: g.plan_amount,
                planCadence: g.plan_cadence,
              });
              const need = requiredContribution({
                targetAmount: g.target_amount,
                currentSaved: saved,
                targetDate: g.target_date,
                cadence: g.plan_cadence ?? 'monthly',
              });
              const linkedAccounts = vehicleList.filter((v) =>
                g.vehicle_ids.includes(v.id)
              );
              const detailHref = `/planner/goal/${g.id}`;
              const editHref = `/planner/goal/${g.id}?edit=1`;
              return (
                <Pressable
                  key={g.id}
                  style={({ pressed }) => [
                    styles.plannerCard,
                    pressed && styles.plannerCardPressed,
                  ]}
                  onPress={() => guardedPush(router, detailHref)}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.name} goal`}
                >
                  <View style={styles.plannerCardTop}>
                    <StrongText style={styles.plannerCardTitle} numberOfLines={2}>
                      {g.name}
                    </StrongText>
                    <Pressable
                      onPress={() => guardedPush(router, editHref)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${g.name}`}
                    >
                      <CaptionText style={styles.editLink}>Edit</CaptionText>
                    </Pressable>
                  </View>
                  <CaptionText
                    style={[styles.muted, { color: paceColor(pace.status) }]}
                  >
                    {GOAL_TYPE_LABELS[g.goal_type]} · {pace.progressPct}% ·{' '}
                    {paceLabel(pace.status)}
                  </CaptionText>
                  <CaptionText style={styles.muted}>
                    {formatUsd(saved)} of {formatUsd(g.target_amount)}
                    {need != null
                      ? ` · ~${formatUsd(need)}/${g.plan_cadence ? PLAN_CADENCE_LABELS[g.plan_cadence].toLowerCase() : 'mo'} to hit date`
                      : ''}
                  </CaptionText>
                  <LinkedAccountLinks
                    accounts={linkedAccounts}
                    label="Linked accounts:"
                    onPressAccount={(id) =>
                      guardedPush(router, `/planner/vehicle/${id}`)
                    }
                  />
                </Pressable>
              );
            })
          )}
        </>
      )}
    </ScrollView>
    </ScrollEdgeHost>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  content: { padding: space.md, paddingBottom: space.xxl, gap: space.sm },
  centered: {
    paddingVertical: space.xxl,
    alignItems: 'center',
    gap: space.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  sectionHeadFirst: {
    marginTop: 0,
  },
  projectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  sectionTitle: { color: colors.green[950], fontSize: 20 },
  headerAdd: {
    paddingHorizontal: space.md,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dashedEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: EMPTY_FILL,
  },
  dashedEmptyPressed: {
    backgroundColor: colors.green[50],
    borderColor: colors.green[200],
  },
  dashedBody: {
    color: colors.inkMuted,
    textAlign: 'center',
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  showChip: {
    maxWidth: 140,
  },
  chipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
  },
  chipDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    opacity: 0.65,
  },
  chipText: { color: colors.ink },
  chipTextSelected: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  chipTextDisabled: {
    color: colors.inkMuted,
  },
  showBlock: {
    gap: space.xs,
    marginTop: space.xs,
  },
  showLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.bodyStrong,
  },
  showHint: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  customInput: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  /** Break out of `content` horizontal padding so the chart is edge-to-edge. */
  chartBleed: {
    marginHorizontal: -space.md,
    alignSelf: 'stretch',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  summaryEnd: { alignItems: 'flex-end' },
  amount: { color: colors.ink, ...typography.amount, fontSize: 18 },
  muted: { color: colors.inkMuted },
  secondary: {
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  plannerCardTitle: { color: colors.ink, flex: 1, paddingRight: space.sm },
  /** Accounts + Goals lists — rounded bordered cards (~14 radius, muted fill). */
  plannerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
    gap: 4,
    marginBottom: 2,
  },
  plannerCardPressed: {
    backgroundColor: colors.green[50],
    borderColor: colors.green[200],
  },
  plannerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  editLink: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
});
