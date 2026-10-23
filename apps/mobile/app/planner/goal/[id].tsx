import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { GoalForm } from '@/components/planner/GoalForm';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import {
  DISCLAIMER,
  GOAL_TYPE_LABELS,
  PLAN_CADENCE_LABELS,
} from '@/constants/planner';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import {
  useContributionEvents,
  useLogContribution,
  usePlannerGoal,
  usePlannerVehicles,
  useSoftDeletePlannerGoal,
  useUpdatePlannerGoal,
} from '@/hooks/usePlanner';
import { formatUsd, parseMoneyInput } from '@/lib/money';
import {
  formatDateOnly,
  goalEffectiveSaved,
  goalPace,
  requiredContribution,
} from '@/lib/plannerMath';
import type { PlannerGoalInput } from '@/lib/plannerGoals';

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goalQuery = usePlannerGoal(id);
  const vehicles = usePlannerVehicles();
  const events = useContributionEvents(id);
  const update = useUpdatePlannerGoal(id!);
  const remove = useSoftDeletePlannerGoal();
  const log = useLogContribution(id!);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [contribAmount, setContribAmount] = useState('');
  const [contribNote, setContribNote] = useState('');
  const [contribError, setContribError] = useState<string | null>(null);

  async function onSubmit(input: PlannerGoalInput) {
    setError(null);
    try {
      await update.mutateAsync(input);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/planner');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update goal.');
    }
  }

  function onDelete() {
    Alert.alert('Delete goal?', 'This hides the goal from Planner.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await remove.mutateAsync(id!);
              router.back();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Could not delete goal.'
              );
            }
          })();
        },
      },
    ]);
  }

  async function onLogContribution() {
    setContribError(null);
    const amount = parseMoneyInput(contribAmount);
    if (!(amount > 0) || Number.isNaN(amount)) {
      setContribError('Enter an amount greater than zero.');
      return;
    }
    try {
      await log.mutateAsync({
        amount,
        contributed_at: formatDateOnly(new Date()),
        note: contribNote.trim() || null,
      });
      setContribAmount('');
      setContribNote('');
      void goalQuery.refetch();
      void events.refetch();
    } catch (err) {
      setContribError(
        err instanceof Error ? err.message : 'Could not log contribution.'
      );
    }
  }

  if (goalQuery.isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Goal' }} />
        <ActivityIndicator size="large" color={colors.green[700]} />
      </View>
    );
  }

  const goal = goalQuery.data;
  if (!goal) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Goal' }} />
        <TitleText>Goal not found</TitleText>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <CaptionText style={styles.secondaryText}>Back</CaptionText>
        </Pressable>
      </View>
    );
  }

  const linked = goal.vehicle_ids.length > 0;
  const effectiveSaved = goalEffectiveSaved({
    currentSaved: goal.current_saved,
    vehicleIds: goal.vehicle_ids,
    vehicles: vehicles.data ?? [],
  });
  const linkedNames = (vehicles.data ?? [])
    .filter((v) => goal.vehicle_ids.includes(v.id))
    .map((v) => v.name);

  if (mode === 'edit') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Edit goal' }} />
        <GoalForm
          vehicles={vehicles.data ?? []}
          initial={{
            name: goal.name,
            goal_type: goal.goal_type,
            target_amount: String(goal.target_amount),
            target_date: goal.target_date,
            current_saved: String(goal.current_saved),
            plan_amount:
              goal.plan_amount != null ? String(goal.plan_amount) : '',
            plan_cadence: goal.plan_cadence,
            notes: goal.notes ?? '',
            vehicle_ids: goal.vehicle_ids,
          }}
          submitLabel="Save"
          busy={update.isPending}
          error={error}
          allowCurrentSaved
          onSubmit={(input) => void onSubmit(input)}
          onDelete={onDelete}
          deleteBusy={remove.isPending}
        />
      </View>
    );
  }

  const pace = goalPace({
    targetAmount: goal.target_amount,
    currentSaved: effectiveSaved,
    targetDate: goal.target_date,
    createdAt: goal.created_at,
  });
  const need = requiredContribution({
    targetAmount: goal.target_amount,
    currentSaved: effectiveSaved,
    targetDate: goal.target_date,
    cadence: goal.plan_cadence ?? 'monthly',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: goal.name }} />
      <CaptionText style={styles.disclaimer}>{DISCLAIMER}</CaptionText>

      <TitleText style={styles.title}>{goal.name}</TitleText>
      <CaptionText style={styles.muted}>
        {GOAL_TYPE_LABELS[goal.goal_type]}
      </CaptionText>

      <View style={styles.progressBlock}>
        <StrongText style={styles.amount}>
          {formatUsd(effectiveSaved)}
          <CaptionText style={styles.muted}>
            {' '}
            of {formatUsd(goal.target_amount)}
          </CaptionText>
        </StrongText>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.min(100, pace.progressPct)}%` },
            ]}
          />
        </View>
        <CaptionText style={styles.muted}>
          {pace.progressPct}% ·{' '}
          {pace.status === 'ahead'
            ? 'Ahead'
            : pace.status === 'behind'
              ? 'Behind'
              : pace.status === 'on_track'
                ? 'On track'
                : 'No target date'}
          {need != null
            ? ` · ~${formatUsd(need)}/${goal.plan_cadence ? PLAN_CADENCE_LABELS[goal.plan_cadence].toLowerCase() : 'month'} needed`
            : ''}
        </CaptionText>
        {linked ? (
          <CaptionText style={styles.hint}>
            Progress from linked vehicles
            {linkedNames.length > 0 ? `: ${linkedNames.join(', ')}` : ''}.
          </CaptionText>
        ) : null}
        {goal.plan_amount != null && goal.plan_cadence ? (
          <CaptionText style={styles.muted}>
            Plan: {formatUsd(goal.plan_amount)}{' '}
            {PLAN_CADENCE_LABELS[goal.plan_cadence].toLowerCase()}
          </CaptionText>
        ) : null}
      </View>

      <Pressable style={styles.secondary} onPress={() => setMode('edit')}>
        <CaptionText style={styles.secondaryText}>Edit goal</CaptionText>
      </Pressable>

      {linked ? (
        <>
          <TitleText style={styles.section}>Contributions</TitleText>
          <CaptionText style={styles.hint}>
            Progress comes from linked vehicles. Unlink vehicles in Edit to log
            manual contributions.
          </CaptionText>
        </>
      ) : (
        <>
          <TitleText style={styles.section}>Log contribution</TitleText>
          <CaptionText style={styles.hint}>
            Updates progress only — does not create a Transaction.
          </CaptionText>
          <TextInput
            style={styles.input}
            value={contribAmount}
            onChangeText={setContribAmount}
            keyboardType="decimal-pad"
            placeholder="Amount (USD)"
            placeholderTextColor={colors.inkMuted}
          />
          <TextInput
            style={styles.input}
            value={contribNote}
            onChangeText={setContribNote}
            placeholder="Note (optional)"
            placeholderTextColor={colors.inkMuted}
          />
          {contribError ? (
            <CaptionText style={styles.error}>{contribError}</CaptionText>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.primary,
              pressed && styles.primaryPressed,
            ]}
            onPress={() => void onLogContribution()}
            disabled={log.isPending}
          >
            {log.isPending ? (
              <ActivityIndicator color={colors.inkInverse} />
            ) : (
              <StrongText style={styles.primaryText}>
                Log contribution
              </StrongText>
            )}
          </Pressable>

          <TitleText style={styles.section}>History</TitleText>
          {events.isLoading ? (
            <ActivityIndicator color={colors.green[700]} />
          ) : (events.data?.length ?? 0) === 0 ? (
            <CaptionText style={styles.muted}>No contributions yet.</CaptionText>
          ) : (
            (events.data ?? []).map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <StrongText>{formatUsd(e.amount)}</StrongText>
                <CaptionText style={styles.muted}>
                  {e.contributed_at}
                  {e.note ? ` · ${e.note}` : ''}
                </CaptionText>
              </View>
            ))
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.canvas,
  },
  disclaimer: { color: colors.inkMuted, ...typography.caption },
  title: { color: colors.green[950] },
  muted: { color: colors.inkMuted },
  hint: { color: colors.inkMuted, marginBottom: space.xs },
  progressBlock: { gap: space.sm, marginVertical: space.sm },
  amount: { ...typography.amount, color: colors.ink },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: colors.green[700],
  },
  section: {
    color: colors.green[950],
    marginTop: space.lg,
    fontSize: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  primary: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { backgroundColor: colors.green[950] },
  primaryText: { color: colors.inkInverse },
  secondary: {
    alignSelf: 'flex-start',
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
  eventRow: {
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  error: { color: colors.danger },
});
