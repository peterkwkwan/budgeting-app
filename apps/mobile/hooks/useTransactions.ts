import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { useAuth } from '@/lib/auth';
import {
  currentPeriodFocus,
  type PeriodFocus,
} from '@/lib/periods';
import { deviceTimezone } from '@/lib/profile';
import { statsKeys } from '@/lib/stats';
import {
  bulkPatchTransactions,
  createTransaction,
  filterTransactionsForMonth,
  getTransaction,
  listTransactions,
  softDeleteTransaction,
  softDeleteTransactions,
  summarizeUpcomingRepeatsThisMonth,
  transactionKeys,
  updateTransaction,
  type Transaction,
  type TransactionBulkPatch,
  type TransactionInput,
} from '@/lib/transactions';

function invalidateTransactionsAndStats(
  queryClient: ReturnType<typeof useQueryClient>
) {
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  void queryClient.invalidateQueries({ queryKey: statsKeys.all });
}

/**
 * Active transactions from Supabase, then client-split for the focused month:
 * - list: one-offs + recurring on/before local today, within focused month
 * - upcoming: recurring after today within the focused calendar month
 */
export function useTransactionList(focus?: PeriodFocus) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const timeZone = profile?.timezone || deviceTimezone();
  const monthFocus = focus ?? currentPeriodFocus(timeZone);

  const query = useQuery({
    queryKey: transactionKeys.list(),
    queryFn: listTransactions,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.list() });
    }, [queryClient])
  );

  const visible = useMemo(
    () =>
      filterTransactionsForMonth(
        query.data ?? [],
        timeZone,
        monthFocus
      ),
    [query.data, timeZone, monthFocus.year, monthFocus.month]
  );

  const upcoming = useMemo(
    () =>
      summarizeUpcomingRepeatsThisMonth(
        query.data ?? [],
        timeZone,
        new Date(),
        monthFocus
      ),
    [query.data, timeZone, monthFocus.year, monthFocus.month]
  );

  return {
    ...query,
    data: visible,
    allRows: query.data,
    upcoming,
    timeZone,
    focus: monthFocus,
  };
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: transactionKeys.detail(id ?? ''),
    queryFn: () => getTransaction(id!),
    enabled: Boolean(id),
  });
}

export function useCreateTransaction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransactionInput) => {
      if (!user?.id) {
        throw new Error('You must be signed in to add a transaction.');
      }
      return createTransaction(user.id, input);
    },
    onSuccess: () => {
      invalidateTransactionsAndStats(queryClient);
    },
  });
}

export function useUpdateTransaction(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransactionInput) => updateTransaction(id, input),
    onSuccess: () => {
      invalidateTransactionsAndStats(queryClient);
    },
  });
}

export function useSoftDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => softDeleteTransaction(id),
    onSuccess: () => {
      invalidateTransactionsAndStats(queryClient);
    },
  });
}

export function useBulkSoftDeleteTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => softDeleteTransactions(ids),
    onSuccess: () => {
      invalidateTransactionsAndStats(queryClient);
    },
  });
}

export function useBulkPatchTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rows,
      patch,
    }: {
      rows: Transaction[];
      patch: TransactionBulkPatch;
    }) => bulkPatchTransactions(rows, patch),
    onSuccess: () => {
      invalidateTransactionsAndStats(queryClient);
    },
  });
}
