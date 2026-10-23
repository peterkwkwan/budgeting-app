import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
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
import {
  categoriesForType,
  type TransactionType,
} from '@/constants/categories';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatDisplayDate } from '@/lib/dates';
import { deviceTimezone } from '@/lib/profile';
import type { Transaction } from '@/lib/transactions';

export type BulkEditField = 'date' | 'category' | 'note';

type Props = {
  visible: boolean;
  field: BulkEditField | null;
  rows: Transaction[];
  busy?: boolean;
  onCancel: () => void;
  onApply: (patch: {
    occurred_at?: string;
    category?: string;
    note?: string | null;
  }) => void;
};

function titleFor(field: BulkEditField): string {
  switch (field) {
    case 'date':
      return 'Edit dates';
    case 'category':
      return 'Edit categories';
    case 'note':
      return 'Edit notes';
  }
}

function subtitleFor(field: BulkEditField, count: number): string {
  const n = count === 1 ? '1 transaction' : `${count} transactions`;
  switch (field) {
    case 'date':
      return `Apply one date to ${n}.`;
    case 'category':
      return `Apply one category to ${n}.`;
    case 'note':
      return `Apply one note to ${n}.`;
  }
}

/**
 * Shared bulk editor: one value applied to every selected transaction.
 */
export function BulkEditSheet({
  visible,
  field,
  rows,
  busy = false,
  onCancel,
  onApply,
}: Props) {
  const { profile } = useAuth();
  const timeZone = profile?.timezone || deviceTimezone();

  const sharedType: TransactionType | null = useMemo(() => {
    if (rows.length === 0) return null;
    const first = rows[0].type;
    return rows.every((r) => r.type === first) ? first : null;
  }, [rows]);

  const [date, setDate] = useState(() =>
    rows[0] ? new Date(rows[0].occurred_at) : new Date()
  );
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [category, setCategory] = useState<string>(
    () => rows[0]?.category ?? categoriesForType('expense')[0]
  );
  const [note, setNote] = useState(() => rows[0]?.note ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !field) return;
    const seed = rows[0];
    setDate(seed ? new Date(seed.occurred_at) : new Date());
    setShowPicker(Platform.OS === 'ios');
    setCategory(seed?.category ?? categoriesForType('expense')[0]);
    setNote(seed?.note ?? '');
    setLocalError(null);
  }, [visible, field, rows]);

  function onDateChange(_event: DateTimePickerEvent, next?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (next) setDate(next);
  }

  function handleApply() {
    setLocalError(null);
    if (!field) return;

    if (field === 'date') {
      onApply({ occurred_at: date.toISOString() });
      return;
    }

    if (field === 'category') {
      if (!sharedType) {
        setLocalError(
          'Select only expenses or only income to edit categories together.'
        );
        return;
      }
      onApply({ category });
      return;
    }

    if (note.trim().length > 500) {
      setLocalError('Note must be 500 characters or fewer.');
      return;
    }
    onApply({ note: note.trim() || null });
  }

  if (!field) return null;

  const categories = sharedType ? categoriesForType(sharedType) : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.scrim}
        onPress={busy ? undefined : onCancel}
        accessibilityLabel="Dismiss bulk editor"
      >
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
        >
          <TitleText style={styles.title}>{titleFor(field)}</TitleText>
          <CaptionText style={styles.subtitle}>
            {subtitleFor(field, rows.length)}
          </CaptionText>

          {field === 'date' ? (
            <View style={styles.block}>
              <Pressable
                style={styles.input}
                onPress={() => setShowPicker(true)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Choose date"
              >
                <StrongText style={styles.dateText}>
                  {formatDisplayDate(date, timeZone)}
                </StrongText>
              </Pressable>
              {showPicker ? (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                />
              ) : null}
              {Platform.OS === 'ios' && showPicker ? (
                <Pressable
                  onPress={() => setShowPicker(false)}
                  style={styles.doneDate}
                  accessibilityRole="button"
                >
                  <StrongText style={{ color: colors.green[700] }}>
                    Done
                  </StrongText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {field === 'category' ? (
            <View style={styles.block}>
              {!sharedType ? (
                <CaptionText style={styles.hint}>
                  Your selection mixes income and expense. Clear one type, then
                  try again.
                </CaptionText>
              ) : (
                <ScrollView
                  style={styles.catScroll}
                  contentContainerStyle={styles.catWrap}
                  keyboardShouldPersistTaps="handled"
                >
                  {categories.map((cat) => {
                    const selected = category === cat;
                    return (
                      <Pressable
                        key={cat}
                        style={[
                          styles.chip,
                          selected && styles.chipSelected,
                        ]}
                        onPress={() => setCategory(cat)}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <CaptionText
                          style={[
                            styles.chipText,
                            selected && styles.chipTextSelected,
                          ]}
                        >
                          {cat}
                        </CaptionText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : null}

          {field === 'note' ? (
            <View style={styles.block}>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={note}
                onChangeText={setNote}
                placeholder="Add a short note"
                placeholderTextColor={colors.inkMuted}
                multiline
                maxLength={500}
                editable={!busy}
                textAlignVertical="top"
                accessibilityLabel="Note for all selected"
              />
              <CaptionText style={styles.counter}>{note.length}/500</CaptionText>
            </View>
          ) : null}

          {localError ? (
            <CaptionText style={styles.error}>{localError}</CaptionText>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.secondaryPressed,
                busy && styles.disabled,
              ]}
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <StrongText style={styles.secondaryText}>Cancel</StrongText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.primaryPressed,
                (busy || (field === 'category' && !sharedType)) &&
                  styles.disabled,
              ]}
              onPress={handleApply}
              disabled={busy || (field === 'category' && !sharedType)}
              accessibilityRole="button"
              accessibilityLabel="Apply to selected"
            >
              {busy ? (
                <ActivityIndicator color={colors.inkInverse} />
              ) : (
                <StrongText style={styles.primaryText}>Apply</StrongText>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    maxHeight: '80%',
    gap: space.sm,
  },
  title: {
    color: colors.ink,
  },
  subtitle: {
    color: colors.inkMuted,
    marginBottom: space.xs,
  },
  block: {
    gap: space.sm,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dateText: {
    color: colors.ink,
    fontFamily: fonts.body,
  },
  doneDate: {
    alignSelf: 'flex-end',
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
  },
  catScroll: {
    maxHeight: 220,
  },
  catWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.sm + 4,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
  },
  chipText: {
    color: colors.ink,
  },
  chipTextSelected: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  noteInput: {
    minHeight: 96,
    ...typography.body,
    color: colors.ink,
  },
  counter: {
    color: colors.inkMuted,
    alignSelf: 'flex-end',
  },
  hint: {
    color: colors.inkMuted,
  },
  error: {
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  secondary: {
    flex: 1,
    height: 44,
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
  },
  primary: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.green[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    backgroundColor: colors.green[950],
  },
  primaryText: {
    color: colors.inkInverse,
  },
  disabled: {
    opacity: 0.45,
  },
});
