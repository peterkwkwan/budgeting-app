import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { CalendarIcon } from '@/components/icons';
import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, fonts, radius, space } from '@/constants/theme';
import {
  canShiftPeriodFocusForward,
  formatCompactDate,
  periodModeLabel,
  periodModeOptions,
  shiftPeriodFocus,
  type PeriodFocus,
  type PeriodPreset,
} from '@/lib/periods';

export type PeriodSelectorProps = {
  preset: PeriodPreset;
  navLabel: string;
  focus: PeriodFocus;
  timeZone: string;
  onFocusChange: (focus: PeriodFocus) => void;
  /** Stats shows Monthly/Yearly/Period; Transactions is month-only. Default true. */
  showModeMenu?: boolean;
  /** Required when showModeMenu (Stats Period mode). */
  customStart?: Date;
  customEnd?: Date;
  onPresetChange?: (preset: PeriodPreset) => void;
  onCustomStartChange?: (date: Date) => void;
  onCustomEndChange?: (date: Date) => void;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function PeriodSelector({
  preset,
  navLabel,
  focus,
  timeZone,
  customStart,
  customEnd,
  onPresetChange,
  onFocusChange,
  onCustomStartChange,
  onCustomEndChange,
  showModeMenu = true,
}: PeriodSelectorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);

  const today = startOfDay(new Date());
  const fromDay = startOfDay(customStart ?? today);
  const toDay = startOfDay(customEnd ?? today);
  const effectivePreset = showModeMenu ? preset : 'month';
  const canGoNext =
    effectivePreset !== 'custom' &&
    canShiftPeriodFocusForward(focus, effectivePreset, timeZone);

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setPicking(null);
    }
    if (event.type === 'dismissed' || !date) {
      return;
    }

    const picked = startOfDay(date);

    if (picking === 'start') {
      onCustomStartChange?.(picked);
      if (picked.getTime() > toDay.getTime()) {
        onCustomEndChange?.(picked);
      }
    } else if (picking === 'end') {
      onCustomEndChange?.(picked);
      if (picked.getTime() < fromDay.getTime()) {
        onCustomStartChange?.(picked);
      }
    }
  };

  const fromMaximum = toDay.getTime() < today.getTime() ? toDay : today;
  const toMinimum = fromDay;

  const step = (delta: number) => {
    if (effectivePreset === 'custom') return;
    onFocusChange(shiftPeriodFocus(focus, effectivePreset, delta));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar} accessibilityRole="toolbar" accessibilityLabel="Period navigation">
        {effectivePreset === 'custom' ? (
          <View style={styles.periodRange} accessibilityRole="text">
            <Pressable
              style={styles.dateField}
              onPress={() => setPicking('start')}
              accessibilityRole="button"
              accessibilityLabel={`Start date ${formatCompactDate(fromDay, timeZone)}`}
            >
              <CaptionText style={styles.dateFieldText}>
                {formatCompactDate(fromDay, timeZone)}
              </CaptionText>
              <CalendarIcon color={colors.inkMuted} size={14} />
            </Pressable>
            <CaptionText style={styles.tilde}>~</CaptionText>
            <Pressable
              style={styles.dateField}
              onPress={() => setPicking('end')}
              accessibilityRole="button"
              accessibilityLabel={`End date ${formatCompactDate(toDay, timeZone)}`}
            >
              <CaptionText style={styles.dateFieldText}>
                {formatCompactDate(toDay, timeZone)}
              </CaptionText>
              <CalendarIcon color={colors.inkMuted} size={14} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.stepper}>
            <Pressable
              onPress={() => step(-1)}
              style={({ pressed }) => [
                styles.chevronBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                effectivePreset === 'month' ? 'Previous month' : 'Previous year'
              }
              hitSlop={8}
            >
              <StrongText style={styles.chevronGlyph}>‹</StrongText>
            </Pressable>
            <StrongText
              style={styles.navLabel}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {navLabel}
            </StrongText>
            <Pressable
              onPress={() => {
                if (canGoNext) step(1);
              }}
              style={({ pressed }) => [
                styles.chevronBtn,
                !canGoNext && styles.chevronDisabled,
                pressed && canGoNext && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                effectivePreset === 'month' ? 'Next month' : 'Next year'
              }
              accessibilityState={{ disabled: !canGoNext }}
              disabled={!canGoNext}
              hitSlop={8}
            >
              <StrongText
                style={[
                  styles.chevronGlyph,
                  !canGoNext && styles.chevronGlyphDisabled,
                ]}
              >
                ›
              </StrongText>
            </Pressable>
          </View>
        )}

        {showModeMenu ? (
          <Pressable
            style={({ pressed }) => [
              styles.modeTrigger,
              pressed && styles.pressed,
            ]}
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Period mode ${periodModeLabel(preset)}. Change mode.`}
            accessibilityHint="Opens Monthly, Yearly, or Period options"
          >
            <CaptionText style={styles.modeTriggerText}>
              {periodModeLabel(preset)}
            </CaptionText>
            <CaptionText style={styles.modeCaret}>▾</CaptionText>
          </Pressable>
        ) : null}
      </View>

      {showModeMenu ? (
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss period mode menu"
          >
            <Pressable style={styles.menuSheet} accessibilityRole="menu">
              {periodModeOptions().map((opt, index, arr) => {
                const selected = preset === opt.value;
                const last = index === arr.length - 1;
                return (
                  <Pressable
                    key={opt.value}
                    style={({ pressed }) => [
                      styles.menuItem,
                      last && styles.menuItemLast,
                      selected && styles.menuItemSelected,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      onPresetChange?.(opt.value);
                      setMenuOpen(false);
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                  >
                    <StrongText
                      style={[
                        styles.menuItemText,
                        selected && styles.menuItemTextSelected,
                      ]}
                    >
                      {opt.label}
                    </StrongText>
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {picking ? (
        <DateTimePicker
          value={picking === 'start' ? fromDay : toDay}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
          minimumDate={picking === 'end' ? toMinimum : undefined}
          maximumDate={picking === 'start' ? fromMaximum : today}
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
    width: '100%',
    gap: space.xs,
  },
  bar: {
    // Left-packed cluster: ‹ label › [Monthly] — gear stays outside (header trailing).
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
    gap: space.sm,
    minHeight: 36,
    alignSelf: 'stretch',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
  chevronBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronGlyph: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 26,
  },
  chevronGlyphDisabled: {
    color: colors.inkMuted,
  },
  chevronDisabled: {
    opacity: 0.45,
  },
  navLabel: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: fonts.bodyStrong,
  },
  periodRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    minHeight: 32,
  },
  dateFieldText: {
    color: colors.ink,
    fontFamily: fonts.caption,
    fontSize: 13,
  },
  tilde: {
    color: colors.inkMuted,
    paddingHorizontal: 2,
  },
  modeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    minHeight: 32,
  },
  modeTriggerText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
    fontSize: 13,
  },
  modeCaret: {
    color: colors.green[700],
    fontSize: 11,
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.75,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    padding: space.md,
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemSelected: {
    backgroundColor: colors.green[50],
  },
  menuItemText: {
    color: colors.ink,
    fontSize: 16,
  },
  menuItemTextSelected: {
    color: colors.green[700],
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
