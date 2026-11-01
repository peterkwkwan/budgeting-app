import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { MonthDayCalendar } from '@/components/MonthDayCalendar';
import { MonthSwipeSkeleton } from '@/components/MonthSwipeSkeleton';
import { StrongText } from '@/components/StyledText';
import { TransactionRow } from '@/components/TransactionRow';
import { TransactionsEmptyMonth } from '@/components/TransactionsEmptyMonth';
import { WeekDayStrip } from '@/components/WeekDayStrip';
import { colors, space, typography } from '@/constants/theme';
import {
  resolvePeriodBounds,
  type PeriodFocus,
} from '@/lib/periods';
import type { TransactionsDateView } from '@/lib/profile';
import { filterTransactionsForMonth } from '@/lib/transactionModel';
import type { Transaction } from '@/lib/transactions';
import {
  clampDayInMonth,
  dayNetsInMonth,
  defaultSelectedDay,
  filterTransactionsForDay,
  formatDayNet,
  formatFocusDayHeading,
} from '@/lib/transactionsDateView';

type TransactionsMonthPeekProps = {
  focus: PeriodFocus;
  /** Full unfiltered list — null/undefined while the query is still loading. */
  allRows: Transaction[] | undefined;
  listLoading: boolean;
  timeZone: string;
  dateView: TransactionsDateView;
  currency: string;
};

/**
 * Non-interactive adjacent-month peek for Transactions.
 * Shared list is prefetched — peeks render real calendar/list when warm.
 * Full empty screen only when the month is known empty; skeleton only on
 * cold miss before the list arrives.
 */
export function TransactionsMonthPeek({
  focus,
  allRows,
  listLoading,
  timeZone,
  dateView,
  currency,
}: TransactionsMonthPeekProps) {
  const ready = !listLoading && allRows != null;

  const periodLabel = useMemo(
    () => resolvePeriodBounds('month', timeZone, { focus }).navLabel,
    [timeZone, focus.year, focus.month]
  );

  const data = useMemo(
    () =>
      ready ? filterTransactionsForMonth(allRows, timeZone, focus) : [],
    [ready, allRows, timeZone, focus.year, focus.month]
  );

  const selectedDay = useMemo(
    () => defaultSelectedDay(focus, timeZone),
    [focus.year, focus.month, timeZone]
  );

  const dayNets = useMemo(
    () => dayNetsInMonth(data, focus, timeZone),
    [data, focus, timeZone]
  );

  const dayRows = useMemo(
    () => filterTransactionsForDay(data, focus, selectedDay, timeZone),
    [data, focus, selectedDay, timeZone]
  );

  const previewRows = useMemo(() => {
    if (dateView === 'list') return data.slice(0, 6);
    return dayRows.slice(0, 6);
  }, [dateView, data, dayRows]);

  // Cold miss only — never paint empty as a loading stand-in.
  if (!ready) {
    return <MonthSwipeSkeleton />;
  }

  if (data.length === 0) {
    return (
      <View style={styles.emptyRoot}>
        <TransactionsEmptyMonth periodLabel={periodLabel} />
      </View>
    );
  }

  const dayNet = dayNets.get(selectedDay);
  const heading = formatFocusDayHeading(focus, selectedDay, timeZone);

  return (
    <View style={styles.root}>
      {dateView === 'week' ? (
        <WeekDayStrip
          focus={focus}
          selectedDay={selectedDay}
          dayNets={dayNets}
          onSelectDay={() => {}}
          currency={currency}
        />
      ) : null}
      {dateView === 'month' ? (
        <MonthDayCalendar
          focus={focus}
          selectedDay={clampDayInMonth(
            focus.year,
            focus.month,
            selectedDay
          )}
          dayNets={dayNets}
          onSelectDay={() => {}}
          currency={currency}
        />
      ) : null}
      {dateView === 'week' || dateView === 'month' ? (
        <View
          style={[
            styles.dayHeading,
            dateView === 'month' && styles.dayHeadingBelowCalendar,
          ]}
        >
          <StrongText style={styles.dayHeadingText}>{heading}</StrongText>
          <PeekDayNet net={dayNet} currency={currency} />
        </View>
      ) : null}
      <View style={styles.list}>
        {previewRows.map((item) => (
          <TransactionRow
            key={item.id}
            transaction={item}
            hideDate={dateView !== 'list'}
            onPress={() => {}}
          />
        ))}
      </View>
    </View>
  );
}

function PeekDayNet({
  net,
  currency,
}: {
  net: number | undefined;
  currency: string;
}) {
  if (net == null) return null;
  const { text, tone } = formatDayNet(net, { currency });
  const color: string =
    tone === 'income'
      ? colors.income
      : tone === 'expense'
        ? colors.expense
        : colors.inkMuted;
  return <StrongText style={[styles.dayNet, { color }]}>{text}</StrongText>;
}

const styles = StyleSheet.create({
  emptyRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    paddingBottom: space.xxl,
  },
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  dayHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    gap: space.sm,
  },
  dayHeadingBelowCalendar: {
    paddingTop: space.md,
  },
  dayHeadingText: {
    ...typography.caption,
    color: colors.ink,
    flexShrink: 1,
  },
  dayNet: {
    ...typography.caption,
  },
  list: {
    paddingBottom: space.lg,
  },
});
