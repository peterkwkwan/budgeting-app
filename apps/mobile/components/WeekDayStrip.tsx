import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, useNativeGesture } from 'react-native-gesture-handler';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, radius, space } from '@/constants/theme';
import type { PeriodFocus } from '@/lib/periods';
import {
  WEEKDAY_LETTERS_SUN,
  daysInMonth,
  formatDayNet,
  weekdaySun0,
  type DayNetTone,
} from '@/lib/transactionsDateView';

const CHIP_WIDTH = 64;
const CHIP_GAP = space.sm;

type Props = {
  focus: PeriodFocus;
  selectedDay: number;
  /** Day-of-month → net (income − expenses). Omitted days have no transactions. */
  dayNets: ReadonlyMap<number, number>;
  onSelectDay: (day: number) => void;
  /** Account currency for day net chips (default HKD). */
  currency?: string;
};

function toneColor(tone: DayNetTone): string {
  if (tone === 'income') return colors.income;
  if (tone === 'expense') return colors.expense;
  return colors.inkMuted;
}

/** Horizontal day strip for the focused month; tap a day to filter the list. */
export function WeekDayStrip({
  focus,
  selectedDay,
  dayNets,
  onSelectDay,
  currency,
}: Props) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const count = daysInMonth(focus.year, focus.month);
  // The transactions screen treats a horizontal drag as a month change.
  // Once this strip starts scrolling, cancel that pan so the days scroll instead.
  const dayStripScroll = useNativeGesture({ disallowInterruption: true });

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
      <GestureDetector gesture={dayStripScroll} touchAction="pan-x">
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
          const net = dayNets.get(day);
          const label =
            net == null
              ? null
              : formatDayNet(net, { compact: true, currency });
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
                label ? `, net ${label.text}` : ''
              }${selected ? ', selected' : ''}`}
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
              {label ? (
                <CaptionText
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[styles.amount, { color: toneColor(label.tone) }]}
                >
                  {label.text}
                </CaptionText>
              ) : (
                <View style={styles.amountSlot} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      </GestureDetector>
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
  amount: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
    width: '100%',
    fontVariant: ['tabular-nums'],
  },
  amountSlot: {
    height: 12,
  },
});
