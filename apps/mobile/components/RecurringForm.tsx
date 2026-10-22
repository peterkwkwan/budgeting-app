import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
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
import { Text } from '@/components/Themed';
import {
  categoriesForType,
  defaultCategory,
  type TransactionType,
} from '@/constants/categories';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { formatDisplayDate } from '@/lib/dates';
import {
  cadenceLabel,
  RECURRING_CADENCES,
  type RecurringCadence,
  type RecurringSeriesInput,
  type RecurringSeriesUpdateInput,
} from '@/lib/recurring';

export type RecurringFormValues = {
  amount: string;
  type: TransactionType;
  category: string;
  note: string;
  cadence: RecurringCadence;
  anchorAt: Date;
};

type CreateProps = {
  mode: 'create';
  initial?: Partial<RecurringFormValues>;
  timezone: string;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (input: RecurringSeriesInput) => void;
};

type EditProps = {
  mode: 'edit';
  initial: RecurringFormValues;
  timezone: string;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (input: RecurringSeriesUpdateInput) => void;
  onStop?: () => void;
  stopBusy?: boolean;
};

type Props = CreateProps | EditProps;

export function RecurringForm(props: Props) {
  const { initial, submitLabel, busy = false, error = null, timezone } = props;
  const isCreate = props.mode === 'create';

  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [category, setCategory] = useState(
    initial?.category ?? defaultCategory(initial?.type ?? 'expense')
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [cadence, setCadence] = useState<RecurringCadence>(
    initial?.cadence ?? 'monthly'
  );
  const [anchorAt, setAnchorAt] = useState(initial?.anchorAt ?? new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function setTypeAndCategory(next: TransactionType) {
    setType(next);
    const allowed = categoriesForType(next);
    if (!(allowed as readonly string[]).includes(category)) {
      setCategory(defaultCategory(next));
    }
  }

  function onDateChange(_event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (date) {
      setAnchorAt(date);
    }
  }

  function handleSubmit() {
    setLocalError(null);
    const parsed = Number.parseFloat(amount.replace(/,/g, '').trim());
    if (!(parsed > 0) || Number.isNaN(parsed)) {
      setLocalError('Enter an amount greater than zero.');
      return;
    }
    if (note.trim().length > 500) {
      setLocalError('Note must be 500 characters or fewer.');
      return;
    }

    const rounded = Math.round(parsed * 100) / 100;

    if (isCreate) {
      props.onSubmit({
        amount: rounded,
        type,
        category,
        note: note.trim() || null,
        cadence,
        anchor_at: anchorAt.toISOString(),
        timezone,
      });
    } else {
      props.onSubmit({
        amount: rounded,
        type,
        category,
        note: note.trim() || null,
      });
    }
  }

  const categories = categoriesForType(type);
  const displayError = localError ?? error;
  const stopBusy = !isCreate && props.stopBusy ? props.stopBusy : false;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <CaptionText style={styles.label}>Type</CaptionText>
      <View style={styles.segment}>
        {(['expense', 'income'] as const).map((option) => {
          const selected = type === option;
          return (
            <Pressable
              key={option}
              style={[styles.segmentBtn, selected && styles.segmentBtnSelected]}
              onPress={() => setTypeAndCategory(option)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <StrongText
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextSelected,
                ]}
              >
                {option === 'expense' ? 'Expense' : 'Income'}
              </StrongText>
            </Pressable>
          );
        })}
      </View>

      <CaptionText style={styles.label}>Amount (USD)</CaptionText>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colors.inkMuted}
        accessibilityLabel="Amount in USD"
      />

      <CaptionText style={styles.label}>Category</CaptionText>
      <View style={styles.chips}>
        {categories.map((cat) => {
          const selected = category === cat;
          return (
            <Pressable
              key={cat}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setCategory(cat)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isCreate ? (
        <>
          <CaptionText style={styles.label}>Repeats</CaptionText>
          <View style={styles.chips}>
            {RECURRING_CADENCES.map((option) => {
              const selected = cadence === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setCadence(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {cadenceLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <CaptionText style={styles.label}>Starts</CaptionText>
          <Pressable
            style={styles.input}
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
            accessibilityLabel="Choose start date"
          >
            <Text style={styles.dateText}>
              {formatDisplayDate(anchorAt, timezone)}
            </Text>
          </Pressable>
          {showPicker ? (
            <DateTimePicker
              value={anchorAt}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
            />
          ) : null}
          {Platform.OS === 'ios' && showPicker ? (
            <Pressable
              onPress={() => setShowPicker(false)}
              style={styles.doneDate}
            >
              <StrongText style={{ color: colors.green[700] }}>Done</StrongText>
            </Pressable>
          ) : null}
          <CaptionText style={styles.hint}>
            Fudget creates matching ledger entries for the next 90 days in{' '}
            {timezone}. Past dates already on the ledger stay as they are when
            you edit later.
          </CaptionText>
        </>
      ) : (
        <CaptionText style={styles.hint}>
          Saving updates this rule and future ledger entries only. Past entries
          stay the same. Repeats:{' '}
          {cadenceLabel(initial?.cadence ?? 'monthly')} · timezone {timezone}.
        </CaptionText>
      )}

      <CaptionText style={styles.label}>Note (optional)</CaptionText>
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={note}
        onChangeText={setNote}
        placeholder="Add a short note"
        placeholderTextColor={colors.inkMuted}
        multiline
        maxLength={500}
        textAlignVertical="top"
        accessibilityLabel="Optional note"
      />
      <CaptionText style={styles.counter}>{note.length}/500</CaptionText>

      {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

      <Pressable
        style={({ pressed }) => [
          styles.primary,
          (busy || stopBusy) && styles.disabled,
          pressed && !busy && styles.primaryPressed,
        ]}
        onPress={handleSubmit}
        disabled={busy || stopBusy}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
      >
        {busy ? (
          <ActivityIndicator color={colors.inkInverse} />
        ) : (
          <Text style={styles.primaryText}>{submitLabel}</Text>
        )}
      </Pressable>

      {!isCreate && props.onStop ? (
        <Pressable
          style={({ pressed }) => [
            styles.secondary,
            (busy || stopBusy) && styles.disabled,
            pressed && !stopBusy && styles.secondaryPressed,
          ]}
          onPress={props.onStop}
          disabled={busy || stopBusy}
          accessibilityRole="button"
          accessibilityLabel="Stop this series"
        >
          {stopBusy ? (
            <ActivityIndicator color={colors.green[700]} />
          ) : (
            <Text style={styles.secondaryText}>Stop series</Text>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.green[50],
  },
  content: {
    paddingHorizontal: space.md,
    paddingVertical: space.lg,
    gap: space.sm,
    paddingBottom: space.xxl,
  },
  label: {
    marginTop: space.sm,
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  hint: {
    color: colors.inkMuted,
    marginTop: space.xs,
  },
  segment: {
    flexDirection: 'row',
    gap: space.sm,
  },
  segmentBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  segmentBtnSelected: {
    backgroundColor: colors.green[700],
  },
  segmentText: {
    color: colors.green[700],
  },
  segmentTextSelected: {
    color: colors.inkInverse,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    ...typography.body,
    color: colors.ink,
  },
  dateText: {
    ...typography.body,
    color: colors.ink,
  },
  doneDate: {
    alignSelf: 'flex-end',
    paddingVertical: space.xs,
  },
  noteInput: {
    minHeight: 96,
    paddingVertical: space.sm,
  },
  counter: {
    alignSelf: 'flex-end',
    color: colors.inkMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.sm + 4,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[200],
  },
  chipText: {
    ...typography.caption,
    color: colors.ink,
  },
  chipTextSelected: {
    color: colors.green[950],
    fontFamily: fonts.bodyStrong,
  },
  primary: {
    marginTop: space.md,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    backgroundColor: colors.green[950],
    transform: [{ scale: 0.98 }],
  },
  primaryText: {
    fontFamily: fonts.bodyStrong,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkInverse,
  },
  secondary: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.98 }],
  },
  secondaryText: {
    fontFamily: fonts.bodyStrong,
    fontSize: 16,
    lineHeight: 24,
    color: colors.green[700],
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
