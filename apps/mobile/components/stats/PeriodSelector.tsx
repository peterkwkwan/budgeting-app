import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, fonts, radius, space } from '@/constants/theme';
import {
  periodPresetOptions,
  type PeriodPreset,
} from '@/lib/periods';

type Props = {
  preset: PeriodPreset;
  label: string;
  customStart: Date;
  customEnd: Date;
  onPresetChange: (preset: PeriodPreset) => void;
  onCustomStartChange: (date: Date) => void;
  onCustomEndChange: (date: Date) => void;
};

export function PeriodSelector({
  preset,
  label,
  customStart,
  customEnd,
  onPresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: Props) {
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setPicking(null);
    }
    if (event.type === 'dismissed' || !date) {
      return;
    }
    if (picking === 'start') {
      onCustomStartChange(date);
    } else if (picking === 'end') {
      onCustomEndChange(date);
    }
    if (Platform.OS === 'ios') {
      // keep open until user switches
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row} accessibilityRole="tablist">
        {periodPresetOptions().map((opt) => {
          const selected = preset === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onPresetChange(opt.value)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}
            >
              <CaptionText
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {opt.label}
              </CaptionText>
            </Pressable>
          );
        })}
      </View>

      <StrongText style={styles.label}>{label}</StrongText>

      {preset === 'custom' ? (
        <View style={styles.customRow}>
          <Pressable
            style={styles.dateBtn}
            onPress={() => setPicking('start')}
            accessibilityRole="button"
            accessibilityLabel="Custom start date"
          >
            <CaptionText style={styles.dateBtnLabel}>From</CaptionText>
            <StrongText style={styles.dateBtnValue}>
              {customStart.toLocaleDateString()}
            </StrongText>
          </Pressable>
          <Pressable
            style={styles.dateBtn}
            onPress={() => setPicking('end')}
            accessibilityRole="button"
            accessibilityLabel="Custom end date"
          >
            <CaptionText style={styles.dateBtnLabel}>To</CaptionText>
            <StrongText style={styles.dateBtnValue}>
              {customEnd.toLocaleDateString()}
            </StrongText>
          </Pressable>
        </View>
      ) : null}

      {picking ? (
        <DateTimePicker
          value={picking === 'start' ? customStart : customEnd}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
          maximumDate={new Date()}
        />
      ) : null}
      {picking && Platform.OS === 'ios' ? (
        <Pressable
          style={styles.done}
          onPress={() => setPicking(null)}
          accessibilityRole="button"
        >
          <CaptionText style={styles.doneText}>Done</CaptionText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  row: {
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
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    color: colors.inkMuted,
    fontFamily: fonts.caption,
  },
  chipTextSelected: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
  label: {
    color: colors.ink,
  },
  customRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  dateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: space.sm,
    gap: 2,
    minHeight: 48,
  },
  dateBtnLabel: {
    color: colors.inkMuted,
  },
  dateBtnValue: {
    color: colors.ink,
  },
  done: {
    alignSelf: 'flex-end',
    paddingHorizontal: space.md,
    height: 40,
    justifyContent: 'center',
  },
  doneText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
  },
});
