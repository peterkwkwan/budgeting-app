import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import {
  COMPOUND_PERIODS,
  COMPOUND_PERIOD_LABELS,
  PLAN_CADENCES,
  PLAN_CADENCE_LABELS,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  defaultGrowthMode,
  type CompoundPeriod,
  type PlanCadence,
  type VehicleType,
} from '@/constants/planner';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { parseMoneyInput } from '@/lib/money';
import type { PlannerVehicleInput } from '@/lib/plannerVehicles';

export type VehicleFormValues = {
  name: string;
  vehicle_type: VehicleType;
  balance: string;
  annual_rate: string;
  compound_period: CompoundPeriod;
  plan_amount: string;
  plan_cadence: PlanCadence | null;
  notes: string;
};

type Props = {
  initial?: Partial<VehicleFormValues>;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (input: PlannerVehicleInput) => void;
  onDelete?: () => void;
  deleteBusy?: boolean;
};

export function VehicleForm({
  initial,
  submitLabel,
  busy = false,
  error = null,
  onSubmit,
  onDelete,
  deleteBusy = false,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [vehicleType, setVehicleType] = useState<VehicleType>(
    initial?.vehicle_type ?? 'savings'
  );
  const [balance, setBalance] = useState(initial?.balance ?? '');
  const [rate, setRate] = useState(initial?.annual_rate ?? '');
  const [compoundPeriod, setCompoundPeriod] = useState<CompoundPeriod>(
    initial?.compound_period ?? 'yearly'
  );
  const [planAmount, setPlanAmount] = useState(initial?.plan_amount ?? '');
  const [planCadence, setPlanCadence] = useState<PlanCadence | null>(
    initial?.plan_cadence ?? null
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const growth = defaultGrowthMode(vehicleType);
  const planLabel = growth === 'shrink' ? 'Payment' : 'Contribution';
  const rateLabel =
    growth === 'shrink' ? 'Yearly interest (%)' : 'Yearly growth (%)';
  const rateHelper =
    growth === 'shrink'
      ? 'What the loan charges per year (APR). Example: 6 = about 6%.'
      : 'What you expect to earn in a year (like a savings APY). Example: 4 = about 4%.';

  function handleSubmit() {
    setLocalError(null);
    const bal = parseMoneyInput(balance);
    const annual_rate = rate.trim() === '' ? 0 : parseMoneyInput(rate);
    const planRaw = planAmount.trim();
    const plan_amount = planRaw === '' ? null : parseMoneyInput(planRaw);

    if (!name.trim()) {
      setLocalError('Name is required.');
      return;
    }
    if (!(bal >= 0) || Number.isNaN(bal)) {
      setLocalError('Enter a valid balance.');
      return;
    }
    if (Number.isNaN(annual_rate) || annual_rate < 0 || annual_rate > 100) {
      setLocalError('Rate must be between 0 and 100.');
      return;
    }
    if (plan_amount != null && (!(plan_amount > 0) || Number.isNaN(plan_amount))) {
      setLocalError(`${planLabel} amount must be greater than zero.`);
      return;
    }
    if ((plan_amount == null) !== (planCadence == null)) {
      setLocalError(`Set both ${planLabel.toLowerCase()} amount and cadence, or clear both.`);
      return;
    }

    onSubmit({
      name: name.trim(),
      vehicle_type: vehicleType,
      balance: bal,
      annual_rate,
      growth_mode: growth,
      compound_period: compoundPeriod,
      plan_amount,
      plan_cadence: planCadence,
      notes: notes.trim() || null,
    });
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
          placeholder="e.g. High-yield savings"
          placeholderTextColor={colors.inkMuted}
          maxLength={80}
        />

        <FieldLabel>Type</FieldLabel>
        <ChipRow>
          {VEHICLE_TYPES.map((t) => (
            <Chip
              key={t}
              label={VEHICLE_TYPE_LABELS[t]}
              selected={vehicleType === t}
              onPress={() => setVehicleType(t)}
            />
          ))}
        </ChipRow>
        <CaptionText style={styles.hint}>
          {growth === 'shrink'
            ? 'Debt / mortgage — balance shrinks with payments.'
            : 'Grows with compounding at your yearly rate.'}
        </CaptionText>

        <FieldLabel>
          {growth === 'shrink' ? 'Principal (USD)' : 'Balance (USD)'}
        </FieldLabel>
        <TextInput
          style={styles.input}
          value={balance}
          onChangeText={setBalance}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.inkMuted}
        />

        <FieldLabel>{rateLabel}</FieldLabel>
        <TextInput
          style={styles.input}
          value={rate}
          onChangeText={setRate}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.inkMuted}
        />
        <CaptionText style={styles.hint}>{rateHelper}</CaptionText>

        <FieldLabel>Compounds</FieldLabel>
        <ChipRow>
          {COMPOUND_PERIODS.map((p) => (
            <Chip
              key={p}
              label={COMPOUND_PERIOD_LABELS[p]}
              selected={compoundPeriod === p}
              onPress={() => setCompoundPeriod(p)}
            />
          ))}
        </ChipRow>
        <CaptionText style={styles.hint}>
          {compoundPeriod === 'yearly'
            ? 'Full yearly rate applied once per year (default); contributions or payments still monthly.'
            : 'Yearly rate divided by 12 and applied each month.'}
        </CaptionText>

        <FieldLabel>Planned {planLabel.toLowerCase()} (optional)</FieldLabel>
        <TextInput
          style={styles.input}
          value={planAmount}
          onChangeText={(v) => {
            setPlanAmount(v);
            if (v.trim() && !planCadence) setPlanCadence('monthly');
            if (!v.trim()) setPlanCadence(null);
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
