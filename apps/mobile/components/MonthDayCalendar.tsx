import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, radius, space } from '@/constants/theme';
import type { PeriodFocus } from '@/lib/periods';
import {
  WEEKDAY_LETTERS_SUN,
  monthGridCells,
} from '@/lib/transactionsDateView';

type Props = {
  focus: PeriodFocus;
  selectedDay: number;
  daysWithTx: Set<number>;
  onSelectDay: (day: number) => void;
};

/** Full month grid; dots mark days with transactions; tap filters the list. */
export function MonthDayCalendar({
  focus,
  selectedDay,
  daysWithTx,
  onSelectDay,
}: Props) {
  const cells = monthGridCells(focus);

  return (
    <View style={styles.wrap}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LETTERS_SUN.map((lab, i) => (
          <View key={`${lab}-${i}`} style={styles.weekdayCell}>
            <CaptionText style={styles.weekdayLabel}>{lab}</CaptionText>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day == null) {
            return <View key={`e-${i}`} style={styles.dayCell} />;
          }
          const selected = day === selectedDay;
          const hasTx = daysWithTx.has(day);
          return (
            <Pressable
              key={day}
              style={({ pressed }) => [
                styles.dayCell,
                selected && styles.dayCellSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => onSelectDay(day)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${day}${hasTx ? ', has transactions' : ''}${
                selected ? ', selected' : ''
              }`}
            >
              <StrongText
                style={[styles.dayNum, selected && styles.dayNumSelected]}
              >
                {day}
              </StrongText>
              <View
                style={[styles.dot, hasTx ? styles.dotOn : styles.dotOff]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.hint}>
        <CaptionText style={styles.hintText}>
          Dots = days with transactions · tap a day to filter the list
        </CaptionText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.sm + 4,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: space.xs,
  },
  weekdayCell: {
    width: '14.2857%',
    alignItems: 'center',
  },
  weekdayLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    gap: 2,
  },
  dayCellSelected: {
    backgroundColor: colors.green[50],
  },
  pressed: {
    opacity: 0.75,
  },
  dayNum: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
  },
  dayNumSelected: {
    color: colors.green[700],
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dotOn: {
    backgroundColor: colors.green[700],
  },
  dotOff: {
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hintText: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
