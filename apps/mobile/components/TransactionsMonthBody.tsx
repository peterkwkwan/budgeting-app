import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';

import { MonthDayCalendar } from '@/components/MonthDayCalendar';
import { MonthSwipeSkeleton } from '@/components/MonthSwipeSkeleton';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { TransactionRow } from '@/components/TransactionRow';
import { TransactionsEmptyMonth } from '@/components/TransactionsEmptyMonth';
import { UpcomingRepeatsBar } from '@/components/UpcomingRepeatsBar';
import { WeekDayStrip } from '@/components/WeekDayStrip';
import {
  chromeHairline,
  colors,
  fonts,
  radius,
  space,
  typography,
} from '@/constants/theme';
import { resolvePeriodBounds, type PeriodFocus } from '@/lib/periods';
import type { TransactionsDateView } from '@/lib/profile';
import {
  filterTransactionsForMonth,
  summarizeUpcomingRepeatsThisMonth,
  type Transaction,
  type UpcomingRepeatsSummary,
} from '@/lib/transactions';
import {
  dayNetsInMonth,
  filterTransactionsForDay,
  formatDayNet,
  formatFocusDayHeading,
  groupTransactionsByDay,
  netOfTransactions,
  type DayNetTone,
} from '@/lib/transactionsDateView';

export type TransactionsMonthBodyProps = {
  focus: PeriodFocus;
  /** Full unfiltered list — null/undefined while the query is still loading. */
  allRows: Transaction[] | undefined;
  listLoading: boolean;
  isError: boolean;
  error: unknown;
  isRefetching: boolean;
  onRefetch: () => void;
  timeZone: string;
  dateView: TransactionsDateView;
  currency: string;
  pendingIds: Set<string>;
  categoryFixIds: Set<string>;
  /** Current (center) slot — selection + navigation enabled. */
  active: boolean;
  /** Day to highlight — parent projects the same rule for all three slots. */
  selectedDay: number;
  onSelectedDayChange?: (day: number) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onRowPress: (item: Transaction) => void;
  onRowLongPress: (id: string) => void;
};

/**
 * Full Transactions month UI for one calendar month.
 * Used for prev / current / next pager slots so settle never swaps trees.
 */
export function TransactionsMonthBody({
  focus,
  allRows,
  listLoading,
  isError,
  error,
  isRefetching,
  onRefetch,
  timeZone,
  dateView,
  currency,
  pendingIds,
  categoryFixIds,
  active,
  selectedDay,
  onSelectedDayChange,
  selectionMode,
  selectedIds,
  onRowPress,
  onRowLongPress,
}: TransactionsMonthBodyProps) {
  const router = useRouter();
  const { edges, scrollProps } = useScrollEdges();

  const period = useMemo(
    () => resolvePeriodBounds('month', timeZone, { focus }),
    [timeZone, focus.year, focus.month]
  );

  const ready = !listLoading && allRows != null;

  const data = useMemo(
    () =>
      ready ? filterTransactionsForMonth(allRows, timeZone, focus) : [],
    [ready, allRows, timeZone, focus.year, focus.month]
  );

  const upcoming: UpcomingRepeatsSummary | null = useMemo(
    () =>
      ready
        ? summarizeUpcomingRepeatsThisMonth(
            allRows,
            timeZone,
            new Date(),
            focus
          )
        : null,
    [ready, allRows, timeZone, focus.year, focus.month]
  );

  const daySections = useMemo(
    () => groupTransactionsByDay(data, timeZone),
    [data, timeZone]
  );

  const dayNets = useMemo(
    () => dayNetsInMonth(data, focus, timeZone),
    [data, focus, timeZone]
  );

  const dayRows = useMemo(
    () => filterTransactionsForDay(data, focus, selectedDay, timeZone),
    [data, focus, selectedDay, timeZone]
  );

  const selectedDayHeading = useMemo(
    () => formatFocusDayHeading(focus, selectedDay, timeZone),
    [focus, selectedDay, timeZone]
  );

  const monthHasTransactions = data.length > 0;
  // Selection chrome only on the active center card.
  const showSelection = active && selectionMode;

  function renderRow(item: Transaction) {
    return (
      <TransactionRow
        transaction={item}
        hideDate
        pending={pendingIds.has(item.id)}
        categoryFix={categoryFixIds.has(item.id)}
        selectionMode={showSelection}
        selected={showSelection && selectedIds.has(item.id)}
        onPress={() => {
          if (!active) return;
          onRowPress(item);
        }}
        onLongPress={() => {
          if (!active) return;
          onRowLongPress(item.id);
        }}
      />
    );
  }

  const sharedHeader = (
    <View>
      {upcoming ? (
        <UpcomingRepeatsBar
          summary={upcoming}
          onPress={() => {
            if (!active) return;
            router.push('/recurring');
          }}
        />
      ) : null}
      {monthHasTransactions && dateView === 'week' ? (
        <WeekDayStrip
          focus={focus}
          selectedDay={selectedDay}
          dayNets={dayNets}
          onSelectDay={
            active && onSelectedDayChange ? onSelectedDayChange : () => {}
          }
          currency={currency}
        />
      ) : null}
      {monthHasTransactions && dateView === 'month' ? (
        <MonthDayCalendar
          focus={focus}
          selectedDay={selectedDay}
          dayNets={dayNets}
          onSelectDay={
            active && onSelectedDayChange ? onSelectedDayChange : () => {}
          }
          currency={currency}
        />
      ) : null}
      {monthHasTransactions &&
      (dateView === 'week' || dateView === 'month') ? (
        <View
          style={[
            styles.dayHeading,
            dateView === 'month' && styles.dayHeadingBelowCalendar,
          ]}
        >
          <StrongText style={styles.dayHeadingText}>
            {selectedDayHeading}
          </StrongText>
          <DayNetAmount net={dayNets.get(selectedDay)} currency={currency} />
        </View>
      ) : null}
    </View>
  );

  const emptyMonth = (
    <TransactionsEmptyMonth periodLabel={period.navLabel} />
  );

  const emptyDay = (
    <View style={styles.emptyDay}>
      <CaptionText style={styles.emptyBody}>
        No transactions this day
      </CaptionText>
    </View>
  );

  const emptyListBody =
    data.length === 0 ? (
      upcoming ? (
        <View style={styles.emptyBelowBar}>
          <CaptionText style={styles.emptyBody}>
            No transactions for today or earlier in {period.navLabel}. Upcoming
            repeats are listed above.
          </CaptionText>
        </View>
      ) : (
        emptyMonth
      )
    ) : undefined;

  if (!ready) {
    return <MonthSwipeSkeleton />;
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <TitleText style={styles.emptyTitle}>
          Couldn’t load transactions
        </TitleText>
        <CaptionText style={styles.emptyBody}>
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </CaptionText>
        {active ? (
          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.secondaryPressed,
            ]}
            onPress={() => onRefetch()}
          >
            <CaptionText style={styles.secondaryText}>Try again</CaptionText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollEdgeHost edges={edges}>
      {dateView === 'list' ? (
        <SectionList
          sections={daySections}
          keyExtractor={(item) => item.id}
          {...scrollProps}
          stickySectionHeadersEnabled
          ListHeaderComponent={sharedHeader}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <StrongText style={styles.sectionHeaderText}>
                {section.title}
              </StrongText>
              <DayNetAmount
                net={netOfTransactions(section.data)}
                currency={currency}
              />
            </View>
          )}
          renderItem={({ item }) => renderRow(item)}
          refreshing={active && isRefetching}
          onRefresh={active ? () => onRefetch() : undefined}
          contentContainerStyle={
            daySections.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={emptyListBody}
        />
      ) : (
        <FlatList
          data={dayRows}
          keyExtractor={(item) => item.id}
          {...scrollProps}
          ListHeaderComponent={sharedHeader}
          renderItem={({ item }) => renderRow(item)}
          refreshing={active && isRefetching}
          onRefresh={active ? () => onRefetch() : undefined}
          contentContainerStyle={
            dayRows.length === 0 && data.length === 0 && !upcoming
              ? styles.emptyList
              : styles.list
          }
          ListEmptyComponent={
            data.length === 0 && !upcoming
              ? emptyMonth
              : data.length === 0 && upcoming
                ? (
                    <View style={styles.emptyBelowBar}>
                      <CaptionText style={styles.emptyBody}>
                        No transactions for today or earlier in{' '}
                        {period.navLabel}. Upcoming repeats are listed above.
                      </CaptionText>
                    </View>
                  )
                : emptyDay
          }
        />
      )}
    </ScrollEdgeHost>
  );
}

function dayNetColor(tone: DayNetTone): string {
  if (tone === 'income') return colors.income;
  if (tone === 'expense') return colors.expense;
  return colors.inkMuted;
}

function DayNetAmount({
  net,
  currency,
}: {
  net: number | null | undefined;
  currency?: string;
}) {
  if (net == null) return null;
  const label = formatDayNet(net, { currency });
  return (
    <StrongText
      style={[styles.dayNet, { color: dayNetColor(label.tone) }]}
      accessibilityLabel={`Day net ${label.text}`}
    >
      {label.text}
    </StrongText>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: space.xxl,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: space.xxl,
  },
  emptyBelowBar: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  emptyDay: {
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  dayHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  /** Stronger than a hairline so the month grid and this row stay separate. */
  dayHeadingBelowCalendar: {
    borderTopWidth: chromeHairline.width,
    borderTopColor: chromeHairline.color,
  },
  dayHeadingText: {
    flexShrink: 1,
    color: colors.green[700],
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionHeaderText: {
    flexShrink: 1,
    color: colors.green[700],
    fontSize: 13,
    lineHeight: 18,
  },
  dayNet: {
    ...typography.amount,
    fontSize: 13,
    lineHeight: 18,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  emptyTitle: {
    color: colors.green[950],
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.inkMuted,
    textAlign: 'center',
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  secondary: {
    marginTop: space.sm,
    paddingHorizontal: space.md,
    height: 40,
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
    fontFamily: fonts.bodyStrong,
  },
});
