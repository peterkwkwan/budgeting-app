import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { ProjectionChart } from '@/components/planner/ProjectionChart';
import { ProjectionEmptyWell } from '@/components/planner/ProjectionEmptyWell';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import {
  DISCLAIMER,
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
import { formatUsd } from '@/lib/money';
import { guardedPush } from '@/lib/navGuard';
import {
  goalEffectiveSaved,
  goalMarkerMonth,
  goalPace,
  projectNetWorth,
  requiredContribution,
  type PaceStatus,
} from '@/lib/plannerMath';

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

export default function PlannerScreen() {
  const router = useRouter();
  const vehicles = usePlannerVehicles();
  const goals = usePlannerGoals();

  const [horizonKey, setHorizonKey] = useState<HorizonPresetKey>('10y');
  const [customYears, setCustomYears] = useState('15');

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

  const projection = useMemo(() => {
    const list = vehicles.data ?? [];
    return projectNetWorth(
      list.map((v) => ({
        balance: v.balance,
        annualRatePercent: v.annual_rate,
        growthMode: v.growth_mode,
        compoundPeriod: v.compound_period,
        planAmount: v.plan_amount,
        planCadence: v.plan_cadence,
      })),
      horizonMonths
    );
  }, [vehicles.data, horizonMonths]);

  const markers = useMemo(() => {
    return (goals.data ?? [])
      .map((g) => {
        const month = goalMarkerMonth(g.target_date, horizonMonths);
        if (month == null) return null;
        return { month, label: g.name };
      })
      .filter((m): m is { month: number; label: string } => m != null);
  }, [goals.data, horizonMonths]);

  const refreshing = vehicles.isRefetching || goals.isRefetching;
  const loading = vehicles.isLoading || goals.isLoading;
  const error =
    (vehicles.error instanceof Error && vehicles.error.message) ||
    (goals.error instanceof Error && goals.error.message) ||
    null;

  const hasVehicles = (vehicles.data?.length ?? 0) > 0;
  const hasGoals = (goals.data?.length ?? 0) > 0;
  const endNet = projection[projection.length - 1]?.netWorth ?? 0;
  const startNet = projection[0]?.netWorth ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
          <CaptionText style={styles.disclaimer}>{DISCLAIMER}</CaptionText>

          <View style={styles.sectionHead}>
            <TitleText style={styles.sectionTitle}>Projection</TitleText>
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

          {!hasVehicles ? (
            <ProjectionEmptyWell
              onPress={() => guardedPush(router, ADD_VEHICLE)}
            />
          ) : (
            <>
              <ProjectionChart
                data={projection}
                markers={markers}
                emptyLabel="No projection yet"
              />
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
            <TitleText style={styles.sectionTitle}>Vehicles</TitleText>
            {hasVehicles ? (
              <Pressable
                style={styles.headerAdd}
                onPress={() => guardedPush(router, ADD_VEHICLE)}
                accessibilityRole="button"
                accessibilityLabel="Add vehicle"
              >
                <CaptionText style={styles.secondaryText}>
                  Add vehicle
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
              accessibilityLabel="Add vehicle"
            >
              <PlusIcon color={colors.green[700]} size={22} />
              <CaptionText style={styles.dashedBody}>
                Track savings, investments, cash, or debt with a rate and
                optional plan.
              </CaptionText>
              <CaptionText style={styles.secondaryText}>Add vehicle</CaptionText>
            </Pressable>
          ) : (
            (vehicles.data ?? []).map((v) => (
              <Pressable
                key={v.id}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => router.push(`/planner/vehicle/${v.id}`)}
              >
                <View style={styles.rowMain}>
                  <StrongText style={styles.rowTitle}>{v.name}</StrongText>
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
                </View>
              </Pressable>
            ))
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
                  Link vehicles when you add a goal.
                </CaptionText>
              ) : null}
              <CaptionText style={styles.secondaryText}>Add goal</CaptionText>
            </Pressable>
          ) : (
            (goals.data ?? []).map((g) => {
              const saved = goalEffectiveSaved({
                currentSaved: g.current_saved,
                vehicleIds: g.vehicle_ids,
                vehicles: vehicles.data ?? [],
              });
              const pace = goalPace({
                targetAmount: g.target_amount,
                currentSaved: saved,
                targetDate: g.target_date,
                createdAt: g.created_at,
              });
              const need = requiredContribution({
                targetAmount: g.target_amount,
                currentSaved: saved,
                targetDate: g.target_date,
                cadence: g.plan_cadence ?? 'monthly',
              });
              const linkedCount = g.vehicle_ids.length;
              return (
                <Pressable
                  key={g.id}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() => router.push(`/planner/goal/${g.id}`)}
                >
                  <View style={styles.rowMain}>
                    <StrongText style={styles.rowTitle}>{g.name}</StrongText>
                    <CaptionText
                      style={[styles.muted, { color: paceColor(pace.status) }]}
                    >
                      {GOAL_TYPE_LABELS[g.goal_type]} · {pace.progressPct}% ·{' '}
                      {paceLabel(pace.status)}
                      {linkedCount > 0
                        ? ` · ${linkedCount} vehicle${linkedCount === 1 ? '' : 's'}`
                        : ''}
                    </CaptionText>
                    <CaptionText style={styles.muted}>
                      {formatUsd(saved)} of {formatUsd(g.target_amount)}
                      {need != null
                        ? ` · ~${formatUsd(need)}/${g.plan_cadence ? PLAN_CADENCE_LABELS[g.plan_cadence].toLowerCase() : 'mo'} to hit date`
                        : ''}
                    </CaptionText>
                  </View>
                </Pressable>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.md, paddingBottom: space.xxl, gap: space.sm },
  centered: {
    paddingVertical: space.xxl,
    alignItems: 'center',
    gap: space.sm,
  },
  disclaimer: {
    color: colors.inkMuted,
    ...typography.caption,
    marginBottom: space.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    marginBottom: space.xs,
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
  chipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
  },
  chipText: { color: colors.ink },
  chipTextSelected: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
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
  row: {
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowMain: { gap: 2 },
  rowTitle: { color: colors.ink },
});
