import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useRef, useState, type ComponentRef } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarIcon } from '@/components/icons';
import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, fonts, radius, space } from '@/constants/theme';
import {
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
  const insets = useSafeAreaInsets();
  const modeTriggerRef = useRef<ComponentRef<typeof View>>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, right: 0 });
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);

  const today = startOfDay(new Date());
  const fromDay = startOfDay(customStart ?? today);
  const toDay = startOfDay(customEnd ?? today);
  const effectivePreset = showModeMenu ? preset : 'month';

  const openModeMenu = () => {
    const fallbackTop = insets.top + 52;
    const node = modeTriggerRef.current as
      | (ComponentRef<typeof View> & {
          measureInWindow?: (
            cb: (x: number, y: number, width: number, height: number) => void
          ) => void;
        })
      | null;
    if (!node?.measureInWindow) {
      setMenuAnchor({ top: fallbackTop, right: space.md });
      setMenuOpen(true);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      const screenW = Dimensions.get('window').width;
      setMenuAnchor({
        top: y + height + 4,
        right: Math.max(space.sm, screenW - (x + width)),
      });
      setMenuOpen(true);
    });
  };

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
      <View
        style={[styles.bar, showModeMenu && styles.barWithMode]}
        accessibilityRole="toolbar"
        accessibilityLabel="Period navigation"
      >
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
              onPress={() => step(1)}
              style={({ pressed }) => [
                styles.chevronBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                effectivePreset === 'month' ? 'Next month' : 'Next year'
              }
              hitSlop={8}
            >
              <StrongText style={styles.chevronGlyph}>›</StrongText>
            </Pressable>
          </View>
        )}

        {showModeMenu ? (
          <View ref={modeTriggerRef} collapsable={false}>
            <Pressable
              style={({ pressed }) => [
                styles.modeTrigger,
                pressed && styles.pressed,
              ]}
              onPress={openModeMenu}
              accessibilityRole="button"
              accessibilityLabel={`Period mode ${periodModeLabel(preset)}. Change mode.`}
              accessibilityHint="Opens Monthly, Yearly, or Period options"
            >
              <CaptionText style={styles.modeTriggerText}>
                {periodModeLabel(preset)}
              </CaptionText>
              <CaptionText style={styles.modeCaret}>▾</CaptionText>
            </Pressable>
          </View>
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
            <Pressable
              style={[
                styles.menuSheet,
                {
                  position: 'absolute',
                  top: menuAnchor.top,
                  right: menuAnchor.right,
                },
              ]}
              accessibilityRole="menu"
            >
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
    // Transactions (no mode): left-packed ‹ label ›.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
    gap: space.sm,
    minHeight: 36,
    alignSelf: 'stretch',
    width: '100%',
  },
  barWithMode: {
    // Stats: left = chevrons/label or dates; right = [Monthly] (gear is outside).
    justifyContent: 'space-between',
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
    gap: 3,
    // Slightly larger tap target (Stats-only); keep compact, not oversized.
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    minHeight: 36,
  },
  modeTriggerText: {
    color: colors.green[700],
    fontFamily: fonts.bodyStrong,
    fontSize: 14,
  },
  modeCaret: {
    color: colors.green[700],
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.75,
  },
  menuBackdrop: {
    flex: 1,
    // Light dim only — menu is top-anchored under the trigger, not a bottom sheet.
    backgroundColor: 'rgba(28, 28, 30, 0.2)',
  },
  menuSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minWidth: 148,
    // Soft elevation so it reads as a compact header menu.
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  menuItem: {
    paddingVertical: space.sm + 4,
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
