import { useNavigation, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  BulkEditSheet,
  type BulkEditField,
} from '@/components/BulkEditSheet';
import {
  MonthCardPager,
  type MonthCardSlot,
} from '@/components/MonthCardPager';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PeriodSelector } from '@/components/stats/PeriodSelector';
import { StrongText } from '@/components/StyledText';
import { TransactionsMonthBody } from '@/components/TransactionsMonthBody';
import { TxnSelectionHeader } from '@/components/TxnSelectionHeader';
import { colors, radius, space } from '@/constants/theme';
import { usePrefetchTransactionMonths } from '@/hooks/useMonthPrefetch';
import {
  useBulkPatchTransactions,
  useBulkSoftDeleteTransactions,
  useTransactionList,
} from '@/hooks/useTransactions';
import { useOfflineGates } from '@/hooks/useOfflineGates';
import { useAuth } from '@/lib/auth';
import { userFacingOfflineWriteError } from '@/lib/offline/writeError';
import {
  PeriodNavHeader,
  periodNavScreenOptions,
} from '@/lib/periodHeader';
import {
  currentPeriodFocus,
  resolvePeriodBounds,
  shiftPeriodFocus,
  type PeriodFocus,
} from '@/lib/periods';
import { parseTransactionsDateView } from '@/lib/profile';
import {
  clampDayInMonth,
  defaultSelectedDay,
  filterTransactionsForDay,
} from '@/lib/transactionsDateView';
import { filterTransactionsForMonth } from '@/lib/transactionModel';
import type { Transaction } from '@/lib/transactions';
import { zonedYmd } from '@/lib/dates';

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

  // Shared with PeriodSelector so the header month tracks the card swipe.
  const swipeTranslateX = useSharedValue(0);
  const swipePagerWidth = useSharedValue(0);
  const [monthNavLocked, setMonthNavLocked] = useState(false);

  const period = useMemo(
    () => resolvePeriodBounds('month', timeZone, { focus }),
    [timeZone, focus]
  );

  const prevMonthFocus = useMemo(
    () => shiftPeriodFocus(focus, 'month', -1),
    [focus.year, focus.month]
  );
  const nextMonthFocus = useMemo(
    () => shiftPeriodFocus(focus, 'month', 1),
    [focus.year, focus.month]
  );
  const prevNavLabel = useMemo(
    () =>
      resolvePeriodBounds('month', timeZone, { focus: prevMonthFocus }).navLabel,
    [timeZone, prevMonthFocus.year, prevMonthFocus.month]
  );
  const nextNavLabel = useMemo(
    () =>
      resolvePeriodBounds('month', timeZone, { focus: nextMonthFocus }).navLabel,
    [timeZone, nextMonthFocus.year, nextMonthFocus.month]
  );
  const swipeMotion = useMemo(
    () => ({
      translateX: swipeTranslateX,
      pagerWidth: swipePagerWidth,
      prevLabel: prevNavLabel,
      nextLabel: nextNavLabel,
    }),
    [swipeTranslateX, swipePagerWidth, prevNavLabel, nextNavLabel]
  );

  const {
    allRows,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useTransactionList(focus);

  // Shared list feeds all three month slots; keep it warm.
  usePrefetchTransactionMonths(true);

  const bulkDelete = useBulkSoftDeleteTransactions();
  const bulkPatch = useBulkPatchTransactions();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [bulkField, setBulkField] = useState<BulkEditField | null>(null);

  const busy = bulkDelete.isPending || bulkPatch.isPending;
  const { pendingIds, categoryFixIds, banner } = useOfflineGates();

  // Clamp before paint so settle matches the adjacent slot’s projected day.
  useLayoutEffect(() => {
    setSelectedDay((prev) => {
      const today = zonedYmd(new Date(), timeZone);
      if (today.year === focus.year && today.month === focus.month) {
        return today.day;
      }
      return clampDayInMonth(focus.year, focus.month, prev);
    });
  }, [focus.year, focus.month, timeZone]);

  const monthRows = useMemo(
    () =>
      allRows != null
        ? filterTransactionsForMonth(allRows, timeZone, focus)
        : [],
    [allRows, timeZone, focus.year, focus.month]
  );

  const dayRows = useMemo(
    () => filterTransactionsForDay(monthRows, focus, selectedDay, timeZone),
    [monthRows, focus, selectedDay, timeZone]
  );

  const listForSelection = dateView === 'list' ? monthRows : dayRows;

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
                  userFacingOfflineWriteError(err, 'Something went wrong.')
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
            userFacingOfflineWriteError(err, 'Something went wrong.')
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
            swipeMotion={swipeMotion}
            monthNavLocked={monthNavLocked}
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
    swipeMotion,
    monthNavLocked,
  ]);

  const onRowPress = useCallback(
    (item: Transaction) => {
      if (selectionMode) {
        toggleSelection(item.id);
        return;
      }
      router.push(`/transaction/${item.id}`);
    },
    [selectionMode, toggleSelection, router]
  );

  const onRowLongPress = useCallback(
    (id: string) => {
      if (!selectionMode) enterSelection(id);
    },
    [selectionMode, enterSelection]
  );

  const onMonthStep = useCallback((delta: -1 | 1) => {
    setFocus((current) => shiftPeriodFocus(current, 'month', delta));
  }, []);

  const onRefetch = useCallback(() => {
    void refetch();
  }, [refetch]);

  const renderPage = useCallback(
    (pageFocus: PeriodFocus, slot: MonthCardSlot) => {
      // Same day rule as the focus effect — adjacent slots match settle.
      const today = zonedYmd(new Date(), timeZone);
      const pageDay =
        today.year === pageFocus.year && today.month === pageFocus.month
          ? today.day
          : clampDayInMonth(pageFocus.year, pageFocus.month, selectedDay);
      return (
        <TransactionsMonthBody
          focus={pageFocus}
          allRows={allRows}
          listLoading={isLoading}
          isError={isError}
          error={error}
          isRefetching={isRefetching}
          onRefetch={onRefetch}
          timeZone={timeZone}
          dateView={dateView}
          currency={currency}
          pendingIds={pendingIds}
          categoryFixIds={categoryFixIds}
          active={slot === 'current'}
          selectedDay={slot === 'current' ? selectedDay : pageDay}
          onSelectedDayChange={
            slot === 'current' ? setSelectedDay : undefined
          }
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onRowPress={onRowPress}
          onRowLongPress={onRowLongPress}
        />
      );
    },
    [
      allRows,
      isLoading,
      isError,
      error,
      isRefetching,
      onRefetch,
      timeZone,
      dateView,
      currency,
      pendingIds,
      categoryFixIds,
      selectedDay,
      selectionMode,
      selectedIds,
      onRowPress,
      onRowLongPress,
    ]
  );

  return (
    <View style={styles.container}>
      <OfflineBanner message={banner} />
      <MonthCardPager
        focus={focus}
        enabled={!selectionMode}
        onStep={onMonthStep}
        renderPage={renderPage}
        translateX={swipeTranslateX}
        pagerWidth={swipePagerWidth}
        // Shared list feeds every month slot — ready once the list is warm.
        neighborsReady={!isLoading && allRows != null}
        onInputLockChange={setMonthNavLocked}
      />

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
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
