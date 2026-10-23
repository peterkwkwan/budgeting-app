import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import {
  GOAL_TYPES,
  GOAL_TYPE_LABELS,
  PLAN_CADENCES,
  PLAN_CADENCE_LABELS,
  type GoalType,
  type PlanCadence,
} from '@/constants/planner';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import {
  formatAmountInput,
  formatUsd,
  parseAmountInput,
} from '@/lib/money';
import { formatDateOnly, parseDateOnly } from '@/lib/plannerMath';
import type { PlannerGoalInput } from '@/lib/plannerGoals';
import type { PlannerVehicle } from '@/lib/plannerVehicles';

export type GoalFormValues = {
  name: string;
  goal_type: GoalType;
  target_amount: string;
  target_date: string | null;
  current_saved: string;
  plan_amount: string;
  plan_cadence: PlanCadence | null;
  notes: string;
  vehicle_ids: string[];
};

type Props = {
  initial?: Partial<GoalFormValues>;
  /** Active vehicles available to link (multi-select). */
  vehicles?: PlannerVehicle[];
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  /** When editing, allow setting current_saved directly (create/seed). */
  allowCurrentSaved?: boolean;
  onSubmit: (input: PlannerGoalInput) => void;
  onDelete?: () => void;
  deleteBusy?: boolean;
};

export function GoalForm({
  initial,
  vehicles = [],
  submitLabel,
  busy = false,
  error = null,
  allowCurrentSaved = true,
  onSubmit,
  onDelete,
  deleteBusy = false,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [goalType, setGoalType] = useState<GoalType>(
    initial?.goal_type ?? 'emergency'
  );
  const [targetAmount, setTargetAmount] = useState(() =>
    formatAmountInput(initial?.target_amount ?? '')
  );
  const [targetDate, setTargetDate] = useState<Date | null>(() => {
    if (!initial?.target_date) return null;
    return parseDateOnly(initial.target_date);
  });
  const [currentSaved, setCurrentSaved] = useState(() =>
    formatAmountInput(initial?.current_saved ?? '0')
  );
  const [planAmount, setPlanAmount] = useState(() =>
    formatAmountInput(initial?.plan_amount ?? '')
  );
  const [planCadence, setPlanCadence] = useState<PlanCadence | null>(
    initial?.plan_cadence ?? null
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [vehicleIds, setVehicleIds] = useState<string[]>(
    initial?.vehicle_ids ?? []
  );
  const [showPicker, setShowPicker] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const linked = vehicleIds.length > 0;

  function onDateChange(_e: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (date) setTargetDate(date);
  }

  function handleSubmit() {
    setLocalError(null);
    const target_amount = parseAmountInput(targetAmount);
    const current_saved =
      currentSaved.trim() === '' ? 0 : parseAmountInput(currentSaved);
    const planRaw = planAmount.trim();
    const plan_amount = planRaw === '' ? null : parseAmountInput(planRaw);

    if (!name.trim()) {
      setLocalError('Name is required.');
      return;
    }
    if (!(target_amount > 0) || Number.isNaN(target_amount)) {
      setLocalError('Target amount must be greater than zero.');
      return;
    }
    if (
      !linked &&
      (!(current_saved >= 0) || Number.isNaN(current_saved))
    ) {
      setLocalError('Current saved must be zero or greater.');
      return;
    }
    if (plan_amount != null && (!(plan_amount > 0) || Number.isNaN(plan_amount))) {
      setLocalError('Plan amount must be greater than zero.');
      return;
    }
    if ((plan_amount == null) !== (planCadence == null)) {
      setLocalError('Set both plan amount and cadence, or clear both.');
      return;
    }

    const input: PlannerGoalInput = {
      name: name.trim(),
      goal_type: goalType,
      target_amount,
      target_date: targetDate ? formatDateOnly(targetDate) : null,
      plan_amount,
      plan_cadence: planCadence,
      notes: notes.trim() || null,
      vehicle_ids: vehicleIds,
    };
    if (allowCurrentSaved && !linked) {
      input.current_saved = current_saved;
    }
    onSubmit(input);
  }

  function toggleVehicle(id: string) {
    setVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <FieldLabel>Name</FieldLabel>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Emergency fund"
          placeholderTextColor={colors.inkMuted}
          maxLength={80}
        />

        <FieldLabel>Type</FieldLabel>
        <ChipRow>
          {GOAL_TYPES.map((t) => (
            <Chip
              key={t}
              label={GOAL_TYPE_LABELS[t]}
              selected={goalType === t}
              onPress={() => setGoalType(t)}
            />
          ))}
        </ChipRow>

        <FieldLabel>Target amount (USD)</FieldLabel>
        <TextInput
          style={styles.input}
          value={targetAmount}
          onChangeText={(v) => setTargetAmount(formatAmountInput(v))}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.inkMuted}
        />

        <FieldLabel>Target date (optional)</FieldLabel>
        <View style={styles.dateRow}>
          <Pressable
            style={styles.dateBtn}
            onPress={() => setShowPicker(true)}
          >
            <StrongText style={styles.dateText}>
              {targetDate
                ? targetDate.toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'No date'}
            </StrongText>
          </Pressable>
          {targetDate ? (
            <Pressable onPress={() => setTargetDate(null)}>
              <CaptionText style={styles.clearDate}>Clear</CaptionText>
            </Pressable>
          ) : null}
        </View>
        {showPicker ? (
          <DateTimePicker
            value={targetDate ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        ) : null}

        <FieldLabel>Linked accounts (optional)</FieldLabel>
        {vehicles.length === 0 ? (
          <CaptionText style={styles.hint}>
            No accounts yet. Add a savings or investment account on Planner,
            then link it here so progress uses that balance.
          </CaptionText>
        ) : (
          <>
            <ChipRow>
              {vehicles.map((v) => (
                <Chip
                  key={v.id}
                  label={`${v.name} (${formatUsd(v.balance)})`}
                  selected={vehicleIds.includes(v.id)}
                  onPress={() => toggleVehicle(v.id)}
                />
              ))}
            </ChipRow>
            <CaptionText style={styles.hint}>
              {linked
                ? 'Progress comes from linked accounts (sum of balances). Manual contributions are off while linked.'
                : 'Link one or more accounts to auto-fill progress from their balances. Leave empty to track manually.'}
            </CaptionText>
          </>
        )}

        {allowCurrentSaved && !linked ? (
          <>
            <FieldLabel>Current saved (USD)</FieldLabel>
            <TextInput
              style={styles.input}
              value={currentSaved}
              onChangeText={(v) => setCurrentSaved(formatAmountInput(v))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.inkMuted}
            />
            <CaptionText style={styles.hint}>
              Or log contributions after saving — they add to this total.
            </CaptionText>
          </>
        ) : null}

        <FieldLabel>Planned contribution (optional)</FieldLabel>
        <TextInput
          style={styles.input}
          value={planAmount}
          onChangeText={(v) => {
            const next = formatAmountInput(v);
            setPlanAmount(next);
            if (next.trim() && !planCadence) setPlanCadence('monthly');
            if (!next.trim()) setPlanCadence(null);
          }}
          keyboardType="decimal-pad"
          placeholder="Amount"
          placeholderTextColor={colors.inkMuted}
        />
        <ChipRow>
          {PLAN_CADENCES.map((c) => (
            <Chip
              key={c}
              label={PLAN_CADENCE_LABELS[c]}
              selected={planCadence === c}
              onPress={() =>
                setPlanCadence((prev) => (prev === c ? null : c))
              }
            />
          ))}
        </ChipRow>
        <CaptionText style={styles.hint}>
          Plan only — does not create Transactions.
        </CaptionText>

        <FieldLabel>Notes (optional)</FieldLabel>
        <TextInput
          style={[styles.input, styles.notes]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add a short note"
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={500}
        />

        {(localError || error) && (
          <CaptionText style={styles.error}>{localError || error}</CaptionText>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {onDelete ? (
          <Pressable
            style={({ pressed }) => [
              styles.deleteBtn,
              pressed && styles.deletePressed,
            ]}
            onPress={onDelete}
            disabled={deleteBusy || busy}
          >
            {deleteBusy ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <StrongText style={styles.deleteText}>Delete</StrongText>
            )}
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && styles.savePressed,
            busy && styles.saveDisabled,
          ]}
          onPress={handleSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.inkInverse} />
          ) : (
            <StrongText style={styles.saveText}>{submitLabel}</StrongText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <CaptionText style={styles.label}>{children}</CaptionText>;
}

function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <CaptionText style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </CaptionText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.md, paddingBottom: space.xxl, gap: space.sm },
  label: { color: colors.inkMuted, marginTop: space.sm },
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
  notes: { minHeight: 72, textAlignVertical: 'top' },
  hint: { color: colors.inkMuted, ...typography.caption },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  dateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  dateText: { color: colors.ink },
  clearDate: { color: colors.green[700] },
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
  chipTextSelected: { color: colors.green[700], fontFamily: fonts.bodyStrong },
  error: { color: colors.danger, marginTop: space.sm },
  footer: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePressed: { backgroundColor: colors.green[950] },
  saveDisabled: { opacity: 0.7 },
  saveText: { color: colors.inkInverse },
  deleteBtn: {
    height: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePressed: { backgroundColor: colors.surfaceMuted },
  deleteText: { color: colors.danger },
});
