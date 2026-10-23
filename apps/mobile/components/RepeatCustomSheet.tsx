import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
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
  WEEKDAY_CHIP_LABELS,
  weekdayOfDate,
  type EndsMode,
  type RepeatRule,
  type Weekday,
} from '@/constants/repeatPresets';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import { formatDisplayDate } from '@/lib/dates';
import type { RecurringCadence } from '@/lib/recurring';

const CADENCE_OPTIONS: { value: RecurringCadence; label: string }[] = [
  { value: 'daily', label: 'day' },
  { value: 'weekly', label: 'week' },
  { value: 'monthly', label: 'month' },
  { value: 'yearly', label: 'year' },
];

type Props = {
  visible: boolean;
  startDate: Date;
  timeZone: string;
  initial?: RepeatRule | null;
  onCancel: () => void;
  onSave: (rule: RepeatRule) => void;
};

function toYmd(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '01';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function RepeatCustomSheet({
  visible,
  startDate,
  timeZone,
  initial,
  onCancel,
  onSave,
}: Props) {
  const defaultDow = weekdayOfDate(startDate, timeZone);
  const [cadence, setCadence] = useState<RecurringCadence>(
    initial?.cadence ?? 'weekly'
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    initial?.byweekday?.length
      ? ([...initial.byweekday] as Weekday[])
      : [defaultDow]
  );
  const [endsMode, setEndsMode] = useState<EndsMode>(
    initial?.endsMode ?? 'never'
  );
  const [endsOnDate, setEndsOnDate] = useState(() => {
    if (initial?.endsOn) {
      const [y, m, d] = initial.endsOn.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + 3);
    return d;
  });
  const [showEndsPicker, setShowEndsPicker] = useState(false);
  const [afterCount, setAfterCount] = useState(
    String(initial?.endsAfterCount ?? 12)
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCadence(initial?.cadence ?? 'weekly');
    setWeekdays(
      initial?.byweekday?.length
        ? ([...initial.byweekday] as Weekday[])
        : [weekdayOfDate(startDate, timeZone)]
    );
    setEndsMode(initial?.endsMode ?? 'never');
    setAfterCount(String(initial?.endsAfterCount ?? 12));
    setLocalError(null);
  }, [visible, initial, startDate, timeZone]);

  function toggleDay(day: Weekday) {
    setWeekdays((prev) => {
      if (prev.includes(day)) {
        const next = prev.filter((d) => d !== day);
        return next.length === 0 ? prev : next;
      }
      return [...prev, day].sort((a, b) => a - b) as Weekday[];
    });
  }

  function onEndsDateChange(_e: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowEndsPicker(false);
    if (date) setEndsOnDate(date);
  }

  function handleSave() {
    setLocalError(null);
    if (cadence === 'weekly' && weekdays.length === 0) {
      setLocalError('Pick at least one day of the week.');
      return;
    }
    let endsAfterCount: number | null = null;
    let endsOn: string | null = null;
    if (endsMode === 'after_count') {
      const n = Number.parseInt(afterCount.trim(), 10);
      if (!Number.isInteger(n) || n < 1) {
        setLocalError('Enter how many times (1 or more).');
        return;
      }
      endsAfterCount = n;
    } else if (endsMode === 'on_date') {
      endsOn = toYmd(endsOnDate, timeZone);
    }

    onSave({
      cadence,
      byweekday: cadence === 'weekly' ? weekdays : null,
      endsMode,
      endsOn,
      endsAfterCount,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.scrim} onPress={onCancel}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
        >
          <TitleText style={styles.title}>Custom repeat</TitleText>
          <CaptionText style={styles.subtitle}>
            Repeat every 1 {CADENCE_OPTIONS.find((c) => c.value === cadence)?.label}.
            Interval greater than 1 comes later.
          </CaptionText>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <CaptionText style={styles.label}>Repeat every</CaptionText>
            <View style={styles.row}>
              <View style={styles.everyOne}>
                <StrongText style={{ color: colors.ink }}>1</StrongText>
              </View>
              <View style={styles.cadenceRow}>
                {CADENCE_OPTIONS.map((opt) => {
                  const selected = cadence === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setCadence(opt.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {cadence === 'weekly' ? (
              <>
                <CaptionText style={styles.label}>Repeat on</CaptionText>
                <View style={styles.weekdayRow}>
                  {WEEKDAY_CHIP_LABELS.map(({ day, label }) => {
                    const selected = weekdays.includes(day);
                    return (
                      <Pressable
                        key={day}
                        style={[
                          styles.weekdayChip,
                          selected && styles.weekdayChipSelected,
                        ]}
                        onPress={() => toggleDay(day)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={label}
                      >
                        <StrongText
                          style={[
                            styles.weekdayText,
                            selected && styles.weekdayTextSelected,
                          ]}
                        >
                          {label}
                        </StrongText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <CaptionText style={styles.label}>Ends</CaptionText>
            {(
              [
                { id: 'never' as const, label: 'Never' },
                { id: 'on_date' as const, label: 'On a date' },
                { id: 'after_count' as const, label: 'After a number of times' },
              ] as const
            ).map((opt) => {
              const selected = endsMode === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.endsRow, selected && styles.endsRowSelected]}
                  onPress={() => setEndsMode(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <StrongText
                    style={[
                      styles.endsText,
                      selected && styles.endsTextSelected,
                    ]}
                  >
                    {opt.label}
                  </StrongText>
                </Pressable>
              );
            })}

            {endsMode === 'on_date' ? (
              <>
                <Pressable
                  style={styles.input}
                  onPress={() => setShowEndsPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="End date"
                >
                  <Text style={styles.dateText}>
                    {formatDisplayDate(endsOnDate, timeZone)}
                  </Text>
                </Pressable>
                {showEndsPicker ? (
                  <DateTimePicker
                    value={endsOnDate}
                    mode="date"
                    minimumDate={startDate}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onEndsDateChange}
                  />
                ) : null}
                {Platform.OS === 'ios' && showEndsPicker ? (
                  <Pressable
                    onPress={() => setShowEndsPicker(false)}
                    style={styles.doneDate}
                  >
                    <StrongText style={{ color: colors.green[700] }}>
                      Done
                    </StrongText>
                  </Pressable>
                ) : null}
              </>
            ) : null}

            {endsMode === 'after_count' ? (
              <TextInput
                style={styles.input}
                value={afterCount}
                onChangeText={setAfterCount}
                keyboardType="number-pad"
                placeholder="12"
                placeholderTextColor={colors.inkMuted}
                accessibilityLabel="Number of occurrences"
              />
            ) : null}

            <CaptionText style={styles.hint}>
              Fudget writes matching transactions up to about 90 days ahead
              (or sooner if the series ends).
            </CaptionText>

            {localError ? <Text style={styles.error}>{localError}</Text> : null}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.primary,
              pressed && styles.primaryPressed,
            ]}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel="Save custom repeat"
          >
            <Text style={styles.primaryText}>Done</Text>
          </Pressable>
          <Pressable
            style={styles.cancel}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <StrongText style={{ color: colors.green[700] }}>Cancel</StrongText>
          </Pressable>
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.green[950] },
  subtitle: {
    color: colors.inkMuted,
    marginTop: space.xs,
    marginBottom: space.md,
  },
  scroll: { maxHeight: 420 },
  label: {
    marginTop: space.md,
    marginBottom: space.sm,
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  everyOne: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadenceRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
  chipText: { ...typography.caption, color: colors.ink },
  chipTextSelected: {
    color: colors.green[950],
    fontFamily: fonts.bodyStrong,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  weekdayChip: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  weekdayChipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[700],
  },
  weekdayText: { color: colors.ink },
  weekdayTextSelected: { color: colors.inkInverse },
  endsRow: {
    minHeight: 44,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  endsRowSelected: { backgroundColor: colors.green[50] },
  endsText: { color: colors.ink },
  endsTextSelected: { color: colors.green[700] },
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
    marginTop: space.sm,
  },
  dateText: { ...typography.body, color: colors.ink },
  doneDate: { alignSelf: 'flex-end', paddingVertical: space.xs },
  hint: { color: colors.inkMuted, marginTop: space.md },
  error: { ...typography.caption, color: colors.danger, marginTop: space.sm },
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
  cancel: {
    marginTop: space.sm,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
