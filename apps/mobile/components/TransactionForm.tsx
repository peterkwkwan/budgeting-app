import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { Text } from '@/components/Themed';
import {
  categoriesForType,
  defaultCategory,
  type TransactionType,
} from '@/constants/categories';
import {
  presetById,
  REPEAT_PRESETS,
  shortRepeatLabel,
  type RepeatPreset,
  type RepeatPresetId,
} from '@/constants/repeatPresets';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import type { TransactionInput } from '@/lib/transactions';

export type TransactionFormValues = {
  amount: string;
  type: TransactionType;
  category: string;
  note: string;
  occurredAt: Date;
};

/** One-off txn fields plus optional repeat mapping for Add Transaction. */
export type TransactionFormSubmit = TransactionInput & {
  repeat: RepeatPreset | null;
};

type Props = {
  initial?: Partial<TransactionFormValues>;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  /** When true, show Repeat beside Date (Add Transaction only). */
  allowRepeat?: boolean;
  onSubmit: (input: TransactionFormSubmit) => void;
  onDelete?: () => void;
  deleteBusy?: boolean;
};

export function TransactionForm({
  initial,
  submitLabel,
  busy = false,
  error = null,
  allowRepeat = false,
  onSubmit,
  onDelete,
  deleteBusy = false,
}: Props) {
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [category, setCategory] = useState(
    initial?.category ?? defaultCategory(initial?.type ?? 'expense')
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [occurredAt, setOccurredAt] = useState(initial?.occurredAt ?? new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [repeatId, setRepeatId] = useState<RepeatPresetId>('none');
  const [showRepeatSheet, setShowRepeatSheet] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const repeatPreset = presetById(repeatId);

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
      setOccurredAt(date);
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

    const preset = allowRepeat ? presetById(repeatId) : presetById('none');

    onSubmit({
      amount: Math.round(parsed * 100) / 100,
      type,
      category,
      note: note.trim() || null,
      occurred_at: occurredAt.toISOString(),
      repeat: preset.cadence ? preset : null,
    });
  }

  const categories = categoriesForType(type);
  const displayError = localError ?? error;

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

      <View style={styles.dateRepeatRow}>
        <View style={allowRepeat ? styles.dateCol : styles.dateColFull}>
          <CaptionText style={styles.labelTight}>Date</CaptionText>
          <Pressable
            style={styles.input}
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
            accessibilityLabel="Choose date"
          >
            <Text style={styles.dateText}>
              {occurredAt.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </Pressable>
        </View>
        {allowRepeat ? (
          <View style={styles.repeatCol}>
            <CaptionText style={styles.labelTight}>Repeat</CaptionText>
            <Pressable
              style={[
                styles.input,
                repeatId !== 'none' && styles.repeatActive,
              ]}
              onPress={() => setShowRepeatSheet(true)}
              accessibilityRole="button"
              accessibilityLabel="Choose how often this repeats"
            >
              <Text
                style={[
                  styles.dateText,
                  repeatId !== 'none' && styles.repeatActiveText,
                ]}
                numberOfLines={1}
              >
                {shortRepeatLabel(repeatPreset)}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {showPicker ? (
        <DateTimePicker
          value={occurredAt}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
        />
      ) : null}
      {Platform.OS === 'ios' && showPicker ? (
        <Pressable onPress={() => setShowPicker(false)} style={styles.doneDate}>
          <StrongText style={{ color: colors.green[700] }}>Done</StrongText>
        </Pressable>
      ) : null}
      {allowRepeat && repeatId !== 'none' ? (
        <CaptionText style={styles.hint}>
          Saves as a recurring rule. Fudget adds matching ledger entries for the
          next 90 days.
        </CaptionText>
      ) : null}

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
          (busy || deleteBusy) && styles.disabled,
          pressed && !busy && styles.primaryPressed,
        ]}
        onPress={handleSubmit}
        disabled={busy || deleteBusy}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
      >
        {busy ? (
          <ActivityIndicator color={colors.inkInverse} />
        ) : (
          <Text style={styles.primaryText}>{submitLabel}</Text>
        )}
      </Pressable>

      {onDelete ? (
        <Pressable
          style={({ pressed }) => [
            styles.danger,
            (busy || deleteBusy) && styles.disabled,
            pressed && !deleteBusy && styles.dangerPressed,
          ]}
          onPress={onDelete}
          disabled={busy || deleteBusy}
          accessibilityRole="button"
          accessibilityLabel="Delete transaction"
        >
          {deleteBusy ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.dangerText}>Delete</Text>
          )}
        </Pressable>
      ) : null}

      <Modal
        visible={showRepeatSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRepeatSheet(false)}
      >
        <Pressable
          style={styles.sheetScrim}
          onPress={() => setShowRepeatSheet(false)}
          accessibilityLabel="Dismiss repeat options"
        >
          <Pressable
            style={styles.sheet}
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
          >
            <TitleText style={styles.sheetTitle}>Repeat</TitleText>
            <CaptionText style={styles.sheetSubtitle}>
              How often should this show up in your ledger?
            </CaptionText>
            <ScrollView style={styles.sheetList}>
              {REPEAT_PRESETS.map((preset) => {
                const selected = repeatId === preset.id;
                return (
                  <Pressable
                    key={preset.id}
                    style={[
                      styles.sheetRow,
                      selected && styles.sheetRowSelected,
                    ]}
                    onPress={() => {
                      setRepeatId(preset.id);
                      setShowRepeatSheet(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <StrongText
                      style={[
                        styles.sheetRowText,
                        selected && styles.sheetRowTextSelected,
                      ]}
                    >
                      {preset.label}
                    </StrongText>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={styles.sheetCancel}
              onPress={() => setShowRepeatSheet(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <StrongText style={{ color: colors.green[700] }}>Cancel</StrongText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  labelTight: {
    color: colors.inkMuted,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  hint: {
    color: colors.inkMuted,
  },
  dateRepeatRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
  },
  dateCol: {
    flex: 1.2,
  },
  dateColFull: {
    flex: 1,
  },
  repeatCol: {
    flex: 1,
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
  repeatActive: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[200],
  },
  repeatActiveText: {
    color: colors.green[950],
    fontFamily: fonts.bodyStrong,
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
  danger: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dangerPressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.98 }],
  },
  dangerText: {
    fontFamily: fonts.bodyStrong,
    fontSize: 16,
    lineHeight: 24,
    color: colors.danger,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: colors.green[200],
  },
  sheetTitle: {
    color: colors.green[950],
  },
  sheetSubtitle: {
    color: colors.inkMuted,
    marginTop: space.xs,
    marginBottom: space.md,
  },
  sheetList: {
    maxHeight: 360,
  },
  sheetRow: {
    minHeight: 48,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  sheetRowSelected: {
    backgroundColor: colors.green[50],
  },
  sheetRowText: {
    color: colors.ink,
  },
  sheetRowTextSelected: {
    color: colors.green[700],
  },
  sheetCancel: {
    marginTop: space.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green[700],
  },
});
