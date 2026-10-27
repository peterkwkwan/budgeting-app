import { useNavigation, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';

import {
  BulkEditSheet,
  type BulkEditField,
} from '@/components/BulkEditSheet';
import { MonthDayCalendar } from '@/components/MonthDayCalendar';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  ScrollEdgeHost,
  useScrollEdges,
} from '@/components/ScrollEdgeShadows';
import { PeriodSelector } from '@/components/stats/PeriodSelector';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { TransactionRow } from '@/components/TransactionRow';
import { TxnSelectionHeader } from '@/components/TxnSelectionHeader';
import { UpcomingRepeatsBar } from '@/components/UpcomingRepeatsBar';
import { WeekDayStrip } from '@/components/WeekDayStrip';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import {
  useBulkPatchTransactions,
  useBulkSoftDeleteTransactions,
  useTransactionList,
} from '@/hooks/useTransactions';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { useAuth } from '@/lib/auth';
import {
  PeriodNavHeader,
  periodNavScreenOptions,
} from '@/lib/periodHeader';
import {
  currentPeriodFocus,
  resolvePeriodBounds,
  type PeriodFocus,
} from '@/lib/periods';
import { parseTransactionsDateView } from '@/lib/profile';
import { zonedYmd } from '@/lib/dates';
import {
  clampDayInMonth,
  dayNetsInMonth,
  defaultSelectedDay,
  filterTransactionsForDay,
  formatDayNet,
  formatFocusDayHeading,
  groupTransactionsByDay,
  netOfTransactions,
  type DayNetTone,
} from '@/lib/transactionsDateView';
import type { Transaction } from '@/lib/transactions';

export default function TransactionsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useAuth();
  const timeZone = profile?.timezone || 'UTC';
  const currency = profile?.currency ?? 'HKD';
  // Layout mode is chosen in Account → Settings; honor the saved profile value.
  const dateView = parseTransactionsDateView(profile?.transactions_date_view);

  const [focus, setFocus] = useState<PeriodFocus>(() =>
    currentPeriodFocus(timeZone)
  );
  const [selectedDay, setSelectedDay] = useState(() =>
    defaultSelectedDay(currentPeriodFocus(timeZone), timeZone)
  );

  const period = useMemo(
    () => resolvePeriodBounds('month', timeZone, { focus }),
    [timeZone, focus]
  );

  const { data, upcoming, isLoading, isError, error, refetch, isRefetching } =
    useTransactionList(focus);

  const bulkDelete = useBulkSoftDeleteTransactions();
  const bulkPatch = useBulkPatchTransactions();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [bulkField, setBulkField] = useState<BulkEditField | null>(null);

  const busy = bulkDelete.isPending || bulkPatch.isPending;
  const { pendingIds, categoryFixIds } = useOfflineGates();
  const { edges, scrollProps } = useScrollEdges();

  // Month ‹ ›: jump to today when focus is the current month; else clamp.
  useEffect(() => {
    setSelectedDay((prev) => {
      const today = zonedYmd(new Date(), timeZone);
      if (today.year === focus.year && today.month === focus.month) {
        return today.day;
      }
      return clampDayInMonth(focus.year, focus.month, prev);
    });
  }, [focus.year, focus.month, timeZone]);

  const daySections = useMemo(
    () => groupTransactionsByDay(data ?? [], timeZone),
    [data, timeZone]
  );

  const dayNets = useMemo(
    () => dayNetsInMonth(data ?? [], focus, timeZone),
    [data, focus, timeZone]
  );

  const dayRows = useMemo(
    () =>
      filterTransactionsForDay(data ?? [], focus, selectedDay, timeZone),
    [data, focus, selectedDay, timeZone]
  );

  const selectedDayHeading = useMemo(
    () => formatFocusDayHeading(focus, selectedDay, timeZone),
    [focus, selectedDay, timeZone]
  );

  const listForSelection = dateView === 'list' ? (data ?? []) : dayRows;

  const selectedRows = useMemo(() => {
    return listForSelection.filter((t) => selectedIds.has(t.id));
  }, [listForSelection, selectedIds]);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setOverflowOpen(false);
    setBulkField(null);
  }, []);

  const enterSelection = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
    setOverflowOpen(false);
    setBulkField(null);
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (selectionMode && selectedIds.size === 0) {
      exitSelection();
    }
  }, [selectionMode, selectedIds, exitSelection]);

  // Drop ids that left the visible list (e.g. after delete / period change).
  useEffect(() => {
    if (!selectionMode) return;
    const visible = new Set(listForSelection.map((t) => t.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [listForSelection, selectionMode]);

  const confirmDelete = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const countLabel =
      ids.length === 1 ? '1 transaction' : `${ids.length} transactions`;
    Alert.alert(
      'Delete selected?',
      `${countLabel} will be hidden from Transactions (soft-delete). They are not permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void bulkDelete.mutateAsync(ids).then(
              () => exitSelection(),
              (err: unknown) => {
                Alert.alert(
                  'Could not delete',
                  err instanceof Error ? err.message : 'Something went wrong.'
                );
              }
            );
          },
        },
      ]
    );
  }, [selectedIds, bulkDelete, exitSelection]);

  const openBulk = useCallback((field: BulkEditField) => {
    setOverflowOpen(false);
    setBulkField(field);
  }, []);

  const applyBulk = useCallback(
    (patch: {
      occurred_at?: string;
      category?: string;
      note?: string | null;
    }) => {
      const rows = selectedRows;
      if (rows.length === 0) return;
      void bulkPatch.mutateAsync({ rows, patch }).then(
        () => exitSelection(),
        (err: unknown) => {
          Alert.alert(
            'Could not update',
            err instanceof Error ? err.message : 'Something went wrong.'
          );
        }
      );
    },
    [selectedRows, bulkPatch, exitSelection]
  );

  useLayoutEffect(() => {
    if (selectionMode) {
      navigation.setOptions(
        periodNavScreenOptions(() => (
          <TxnSelectionHeader
            count={selectedIds.size}
            busy={busy}
            onCancel={exitSelection}
            onDelete={confirmDelete}
            onOverflow={() => setOverflowOpen(true)}
          />
        ))
      );
      return;
    }

    navigation.setOptions(
      periodNavScreenOptions(() => (
        <PeriodNavHeader>
          <PeriodSelector
            preset="month"
            navLabel={period.navLabel}
            focus={focus}
            timeZone={timeZone}
            showModeMenu={false}
            onFocusChange={setFocus}
          />
        </PeriodNavHeader>
      ))
    );
  }, [
    navigation,
    selectionMode,
    selectedIds.size,
    busy,
    exitSelection,
    confirmDelete,
    period.navLabel,
    focus,
    timeZone,
  ]);

  function onRowPress(item: Transaction) {
    if (selectionMode) {
      toggleSelection(item.id);
      return;
    }
    router.push(`/transaction/${item.id}`);
  }

  function renderRow(item: Transaction) {
    return (
      <TransactionRow
        transaction={item}
        hideDate
        pending={pendingIds.has(item.id)}
        categoryFix={categoryFixIds.has(item.id)}
        selectionMode={selectionMode}
        selected={selectedIds.has(item.id)}
        onPress={() => onRowPress(item)}
        onLongPress={() => {
          if (!selectionMode) enterSelection(item.id);
        }}
      />
    );
  }

  const monthHasTransactions = (data?.length ?? 0) > 0;

  const sharedHeader = (
    <View>
      {upcoming ? (
        <UpcomingRepeatsBar
          summary={upcoming}
          onPress={() => router.push('/recurring')}
        />
      ) : null}
      {monthHasTransactions && dateView === 'week' ? (
        <WeekDayStrip
          focus={focus}
          selectedDay={selectedDay}
          dayNets={dayNets}
          onSelectDay={setSelectedDay}
          currency={currency}
        />
      ) : null}
      {monthHasTransactions && dateView === 'month' ? (
        <MonthDayCalendar
          focus={focus}
          selectedDay={selectedDay}
          dayNets={dayNets}
          onSelectDay={setSelectedDay}
          currency={currency}
        />
      ) : null}
      {monthHasTransactions &&
      (dateView === 'week' || dateView === 'month') ? (
        <View style={styles.dayHeading}>
          <StrongText style={styles.dayHeadingText}>
            {selectedDayHeading}
          </StrongText>
          <DayNetAmount net={dayNets.get(selectedDay)} currency={currency} />
        </View>
      ) : null}
    </View>
  );

  const emptyMonth = (
    <View style={styles.empty}>
      <TitleText style={styles.emptyTitle}>
        No transactions in {period.navLabel}
      </TitleText>
      <CaptionText style={styles.emptyBody}>
        Tap + to add an expense or income. On the Add screen you can type it, or
        tap the mic to speak a draft before saving. It syncs for every device on
        this account.
      </CaptionText>
    </View>
  );

  const emptyDay = (
    <View style={styles.emptyDay}>
      <CaptionText style={styles.emptyBody}>
        No transactions this day
      </CaptionText>
    </View>
  );

  const emptyListBody =
    (data?.length ?? 0) === 0 ? (
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

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.green[700]} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <TitleText style={styles.emptyTitle}>
            Couldn’t load transactions
          </TitleText>
          <CaptionText style={styles.emptyBody}>
            {error instanceof Error ? error.message : 'Something went wrong.'}
          </CaptionText>
          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.secondaryPressed,
            ]}
            onPress={() => void refetch()}
          >
            <CaptionText style={styles.secondaryText}>Try again</CaptionText>
          </Pressable>
        </View>
      ) : (
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
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
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
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              contentContainerStyle={
                dayRows.length === 0 && (data?.length ?? 0) === 0 && !upcoming
                  ? styles.emptyList
                  : styles.list
              }
              ListEmptyComponent={
                (data?.length ?? 0) === 0 && !upcoming
                  ? emptyMonth
                  : (data?.length ?? 0) === 0 && upcoming
                    ? (
                        <View style={styles.emptyBelowBar}>
                          <CaptionText style={styles.emptyBody}>
                            No transactions for today or earlier in{' '}
                            {period.navLabel}. Upcoming repeats are listed
                            above.
                          </CaptionText>
                        </View>
                      )
                    : emptyDay
              }
            />
          )}
        </ScrollEdgeHost>
      )}

      <Modal
        visible={overflowOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOverflowOpen(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setOverflowOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
        >
          <Pressable style={styles.menuSheet} accessibilityRole="menu">
            {(
              [
                { field: 'date' as const, label: 'Edit dates' },
                { field: 'category' as const, label: 'Edit categories' },
                { field: 'note' as const, label: 'Edit notes' },
              ] as const
            ).map((item, index, arr) => (
              <Pressable
                key={item.field}
                style={({ pressed }) => [
                  styles.menuItem,
                  index === arr.length - 1 && styles.menuItemLast,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={() => openBulk(item.field)}
                accessibilityRole="menuitem"
              >
                <StrongText style={styles.menuItemText}>{item.label}</StrongText>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <BulkEditSheet
        visible={bulkField != null}
        field={bulkField}
        rows={selectedRows}
        busy={bulkPatch.isPending}
        onCancel={() => setBulkField(null)}
        onApply={applyBulk}
      />
    </View>
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
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
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
    paddingTop: space.sm + 2,
    paddingBottom: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
  empty: {
    paddingHorizontal: space.xl,
    alignItems: 'center',
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
  menuBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 88,
    paddingRight: space.md,
  },
  menuSheet: {
    minWidth: 200,
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  menuItemText: {
    color: colors.ink,
  },
});
