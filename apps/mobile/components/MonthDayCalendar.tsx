import { Pressable, StyleSheet, View } from 'react-native';

import { CaptionText, StrongText } from '@/components/StyledText';
import { colors, radius, space } from '@/constants/theme';
import type { PeriodFocus } from '@/lib/periods';
import {
  WEEKDAY_LETTERS_SUN,
  formatDayNet,
  monthGridCells,
  type DayNetTone,
} from '@/lib/transactionsDateView';

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

/** Full month grid; each day with transactions shows that day's net. */
export function MonthDayCalendar({
  focus,
  selectedDay,
  dayNets,
  onSelectDay,
  currency,
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
          const net = dayNets.get(day);
          const label =
            net == null
              ? null
              : formatDayNet(net, { compact: true, plain: true, currency });
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
              accessibilityLabel={`${day}${
                label ? `, net ${label.text}` : ', no transactions'
              }${selected ? ', selected' : ''}`}
            >
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
      </View>
      <View style={styles.hint}>
        <CaptionText style={styles.hintText}>
          Amounts are each day’s net (income − expenses) · tap a day to filter
          the list
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
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    gap: 1,
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
  amount: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
    width: '100%',
    fontVariant: ['tabular-nums'],
  },
  amountSlot: {
    height: 12,
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
