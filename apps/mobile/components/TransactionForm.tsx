import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useState, type ReactNode } from 'react';
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

import { MicButton } from '@/components/MicButton';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { Text } from '@/components/Themed';
import {
  categoriesForType,
  defaultCategory,
  type TransactionType,
} from '@/constants/categories';
import {
  buildRepeatPresetOptions,
  shortRepeatLabel,
  type RepeatRule,
} from '@/constants/repeatPresets';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { RepeatCustomSheet } from '@/components/RepeatCustomSheet';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useAuth } from '@/lib/auth';
import { formatDisplayDate } from '@/lib/dates';
import {
  formatAmountInput,
  parseAmountInput,
} from '@/lib/money';
import { deviceTimezone } from '@/lib/profile';
import type { TransactionInput } from '@/lib/transactions';
import type { VoiceDraft } from '@/lib/voiceParse';

export type TransactionFormValues = {
  amount: string;
  type: TransactionType;
  category: string;
  note: string;
  occurredAt: Date;
};

/** One-off txn fields plus optional repeat rule for Add Transaction. */
export type TransactionFormSubmit = TransactionInput & {
  repeat: RepeatRule | null;
};

type Props = {
  initial?: Partial<TransactionFormValues>;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  /** When true, show Repeat beside Date (Add Transaction only). */
  allowRepeat?: boolean;
  /** When true, footer is [mic][Save] and mic autofills from voice. */
  allowVoice?: boolean;
  /** Optional banner above fields (e.g. voice confirm copy from parent). */
  banner?: ReactNode;
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
  allowVoice = false,
  banner,
  onSubmit,
  onDelete,
  deleteBusy = false,
}: Props) {
  const [amount, setAmount] = useState(() =>
    formatAmountInput(initial?.amount ?? '')
  );
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [category, setCategory] = useState(
    initial?.category ?? defaultCategory(initial?.type ?? 'expense')
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [occurredAt, setOccurredAt] = useState(initial?.occurredAt ?? new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [repeatRule, setRepeatRule] = useState<RepeatRule | null>(null);
  const [showRepeatSheet, setShowRepeatSheet] = useState(false);
  const [showCustomSheet, setShowCustomSheet] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [voiceFilled, setVoiceFilled] = useState(!!initial?.amount);
  const [voicePartial, setVoicePartial] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const { profile } = useAuth();
  const timeZone = profile?.timezone || deviceTimezone();
  const presetOptions = buildRepeatPresetOptions(occurredAt, timeZone);

  const applyVoiceDraft = useCallback((draft: VoiceDraft) => {
    setAmount(formatAmountInput(draft.amount));
    setType(draft.type);
    setCategory(draft.category);
    setNote(draft.note);
    setVoiceFilled(true);
    setVoicePartial(draft.confidence === 'partial');
    setLastHeard(draft.transcript);
    setLocalError(null);
  }, []);

  const voice = useVoiceRecognition({
    active: allowVoice,
    onDraft: applyVoiceDraft,
  });

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
    const parsed = parseAmountInput(amount);
    if (!(parsed > 0) || Number.isNaN(parsed)) {
      setLocalError('Enter an amount greater than zero.');
      return;
    }
    if (note.trim().length > 500) {
      setLocalError('Note must be 500 characters or fewer.');
      return;
    }

    onSubmit({
      amount: Math.round(parsed * 100) / 100,
      type,
      category,
      note: note.trim() || null,
      occurred_at: occurredAt.toISOString(),
      repeat: allowRepeat ? repeatRule : null,
    });
  }

  const categories = categoriesForType(type);
  const displayError = localError ?? error ?? (allowVoice ? voice.error : null);
  const highlightVoice = voiceFilled && allowVoice;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {banner}

        {allowVoice && voice.listening ? (
          <View style={styles.voiceLive} accessibilityRole="summary">
            <StrongText style={styles.voiceLiveTitle}>
              {voice.transcript
                ? `“${voice.transcript}”`
                : 'Listening…'}
            </StrongText>
            <CaptionText style={styles.voiceLiveBody}>
              Speak amount, category, type — tap mic again to stop
              {voice.onDevice ? ' (on-device)' : ''}.
            </CaptionText>
          </View>
        ) : null}

        {allowVoice && voiceFilled && !voice.listening ? (
          <View style={styles.voiceBanner} accessibilityRole="summary">
            <StrongText style={styles.voiceTitle}>
              {voicePartial
                ? 'Check this draft — add an amount'
                : 'Check this draft, then save'}
            </StrongText>
            <CaptionText style={styles.voiceBody}>
              Nothing is saved until you tap Save.
              {lastHeard ? ` Heard: “${lastHeard}”` : ''}
            </CaptionText>
          </View>
        ) : null}

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
          style={[styles.input, highlightVoice && amount ? styles.inputHighlight : null]}
          value={amount}
          onChangeText={(v) => setAmount(formatAmountInput(v))}
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
                {formatDisplayDate(occurredAt, timeZone)}
              </Text>
            </Pressable>
          </View>
          {allowRepeat ? (
            <View style={styles.repeatCol}>
              <CaptionText style={styles.labelTight}>Repeat</CaptionText>
              <Pressable
                style={[
                  styles.input,
                  repeatRule != null && styles.repeatActive,
                ]}
                onPress={() => setShowRepeatSheet(true)}
                accessibilityRole="button"
                accessibilityLabel="Choose how often this repeats"
              >
                <Text
                  style={[
                    styles.dateText,
                    repeatRule != null && styles.repeatActiveText,
                  ]}
                  numberOfLines={1}
                >
                  {shortRepeatLabel(repeatRule)}
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
        {allowRepeat && repeatRule ? (
          <CaptionText style={styles.hint}>
            Saves as a recurring rule. Matching transactions are written about
            90 days ahead (or sooner if the series ends).
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
                How often should this show up in Transactions?
              </CaptionText>
              <ScrollView style={styles.sheetList}>
                {presetOptions.map((preset) => {
                  const selected =
                    preset.id === 'none'
                      ? repeatRule == null
                      : preset.id === 'custom'
                        ? false
                        : preset.rule !== null &&
                          preset.rule !== 'custom' &&
                          repeatRule?.cadence === preset.rule.cadence &&
                          JSON.stringify(repeatRule.byweekday ?? null) ===
                            JSON.stringify(preset.rule.byweekday ?? null) &&
                          repeatRule.endsMode === 'never';
                  return (
                    <Pressable
                      key={preset.id}
                      style={[
                        styles.sheetRow,
                        selected && styles.sheetRowSelected,
                      ]}
                      onPress={() => {
                        if (preset.rule === 'custom') {
                          setShowRepeatSheet(false);
                          setShowCustomSheet(true);
                          return;
                        }
                        setRepeatRule(preset.rule);
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

        <RepeatCustomSheet
          visible={showCustomSheet}
          startDate={occurredAt}
          timeZone={timeZone}
          initial={repeatRule}
          onCancel={() => setShowCustomSheet(false)}
          onSave={(rule) => {
            setRepeatRule(rule);
            setShowCustomSheet(false);
          }}
        />
      </ScrollView>

      <View style={styles.footer}>
        {allowVoice ? (
          <MicButton
            listening={voice.listening}
            onPress={() => voice.toggle()}
            disabled={busy || deleteBusy}
          />
        ) : null}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    paddingHorizontal: space.md,
    paddingVertical: space.lg,
    gap: space.sm,
    paddingBottom: space.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.md,
    paddingTop: space.sm + 4,
    paddingBottom: space.md + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.canvas,
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
    borderColor: colors.border,
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    ...typography.body,
    color: colors.ink,
  },
  inputHighlight: {
    borderColor: colors.green[700],
  },
  repeatActive: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
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
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
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
    marginTop: space.md,
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
  voiceBanner: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    gap: space.xs,
    marginBottom: space.xs,
  },
  voiceLive: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    gap: space.xs,
    marginBottom: space.xs,
  },
  voiceLiveTitle: {
    color: colors.ink,
  },
  voiceLiveBody: {
    color: colors.inkMuted,
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  voiceTitle: {
    color: colors.green[950],
  },
  voiceBody: {
    color: colors.inkMuted,
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
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
    borderColor: colors.border,
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
    borderColor: colors.border,
  },
});
