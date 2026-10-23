import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, radius, space } from '@/constants/theme';
import type { PeriodFocus } from '@/lib/periods';
import {
  WEEKDAY_LETTERS_SUN,
  daysInMonth,
  weekdaySun0,
} from '@/lib/transactionsDateView';

const CHIP_WIDTH = 44;
const CHIP_GAP = space.sm;

type Props = {
  focus: PeriodFocus;
  selectedDay: number;
  onSelectDay: (day: number) => void;
};

/** Horizontal day strip for the focused month; tap a day to filter the list. */
export function WeekDayStrip({ focus, selectedDay, onSelectDay }: Props) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const count = daysInMonth(focus.year, focus.month);

  useEffect(() => {
    const index = Math.max(0, selectedDay - 1);
    const x = index * (CHIP_WIDTH + CHIP_GAP);
    // Delay so layout exists on first mount / month change.
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: Math.max(0, x - CHIP_WIDTH),
        animated: true,
      });
    }, 50);
    return () => clearTimeout(t);
  }, [focus.year, focus.month, selectedDay]);

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {Array.from({ length: count }, (_, i) => {
          const day = i + 1;
          const selected = day === selectedDay;
          const letter =
            WEEKDAY_LETTERS_SUN[weekdaySun0(focus.year, focus.month, day)] ??
            '';
          return (
            <Pressable
              key={day}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => onSelectDay(day)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${letter} ${day}${
                selected ? ', selected' : ''
              }`}
            >
              <CaptionText
                style={[styles.letter, selected && styles.letterSelected]}
              >
                {letter}
              </CaptionText>
              <StrongText
                style={[styles.dayNum, selected && styles.dayNumSelected]}
              >
                {day}
              </StrongText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: CHIP_GAP,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  chip: {
    width: CHIP_WIDTH,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    gap: 2,
  },
  chipSelected: {
    borderColor: colors.green[700],
    backgroundColor: colors.green[50],
  },
  pressed: {
    opacity: 0.8,
  },
  letter: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  letterSelected: {
    color: colors.green[700],
  },
  dayNum: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
  },
  dayNumSelected: {
    color: colors.green[700],
  },
});
