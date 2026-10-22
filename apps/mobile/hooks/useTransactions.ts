import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { useAuth } from '@/lib/auth';
import { deviceTimezone } from '@/lib/profile';
import { statsKeys } from '@/lib/stats';
import {
  createTransaction,
  filterLedgerVisible,
  getTransaction,
  listTransactions,
  softDeleteTransaction,
  summarizeUpcomingRepeatsThisMonth,
  transactionKeys,
  updateTransaction,
  type TransactionInput,
} from '@/lib/transactions';

function invalidateLedgerAndStats(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  void queryClient.invalidateQueries({ queryKey: statsKeys.all });
}

/**
 * Active transactions from Supabase, then client-split:
 * - ledger: one-offs + recurring on/before local today
 * - upcoming: recurring after today within the current calendar month
 */
export function useTransactionList() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const timeZone = profile?.timezone || deviceTimezone();

  const query = useQuery({
    queryKey: transactionKeys.list(),
    queryFn: listTransactions,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.list() });
    }, [queryClient])
  );

  const ledger = useMemo(
    () => filterLedgerVisible(query.data ?? [], timeZone),
    [query.data, timeZone]
  );

  const upcoming = useMemo(
    () => summarizeUpcomingRepeatsThisMonth(query.data ?? [], timeZone),
    [query.data, timeZone]
  );

  return { ...query, data: ledger, allRows: query.data, upcoming, timeZone };
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
      invalidateLedgerAndStats(queryClient);
    },
  });
}

export function useUpdateTransaction(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransactionInput) => updateTransaction(id, input),
    onSuccess: () => {
      invalidateLedgerAndStats(queryClient);
    },
  });
}

export function useSoftDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => softDeleteTransaction(id),
    onSuccess: () => {
      invalidateLedgerAndStats(queryClient);
    },
  });
}
