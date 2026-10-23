import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {
  BulkEditSheet,
  type BulkEditField,
} from '@/components/BulkEditSheet';
import { PeriodSelector } from '@/components/stats/PeriodSelector';
import { CaptionText, StrongText, TitleText } from '@/components/StyledText';
import { TransactionRow } from '@/components/TransactionRow';
import { TxnSelectionHeader } from '@/components/TxnSelectionHeader';
import { UpcomingRepeatsBar } from '@/components/UpcomingRepeatsBar';
import { colors, fonts, radius, space, typography } from '@/constants/theme';
import {
  useBulkPatchTransactions,
  useBulkSoftDeleteTransactions,
  useTransactionList,
} from '@/hooks/useTransactions';
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
import type { Transaction } from '@/lib/transactions';

export default function TransactionsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useAuth();
  const timeZone = profile?.timezone || 'UTC';

  const [focus, setFocus] = useState<PeriodFocus>(() =>
    currentPeriodFocus(timeZone)
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

  const selectedRows = useMemo(() => {
    const list = data ?? [];
    return list.filter((t) => selectedIds.has(t.id));
  }, [data, selectedIds]);

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
    const visible = new Set((data ?? []).map((t) => t.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [data, selectionMode]);

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

  return (
    <View style={styles.container}>
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
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            upcoming ? (
              <UpcomingRepeatsBar
                summary={upcoming}
                onPress={() => router.push('/recurring')}
              />
            ) : undefined
          }
          renderItem={({ item }) => (
            <TransactionRow
              transaction={item}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.id)}
              onPress={() => onRowPress(item)}
              onLongPress={
                selectionMode ? undefined : () => enterSelection(item.id)
              }
            />
          )}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          contentContainerStyle={
            (data?.length ?? 0) === 0 && !upcoming
              ? styles.emptyList
              : styles.list
          }
          ListEmptyComponent={
            upcoming ? (
              <View style={styles.emptyBelowBar}>
                <CaptionText style={styles.emptyBody}>
                  No transactions for today or earlier in {period.navLabel}.
                  Upcoming repeats are listed above.
                </CaptionText>
              </View>
            ) : (
              <View style={styles.empty}>
                <TitleText style={styles.emptyTitle}>
                  No transactions in {period.navLabel}
                </TitleText>
                <CaptionText style={styles.emptyBody}>
                  Tap + to add an expense or income. On the Add screen you can
                  type it, or tap the mic to speak a draft before saving. It
                  syncs for every device on this account.
                </CaptionText>
              </View>
            )
          }
        />
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
