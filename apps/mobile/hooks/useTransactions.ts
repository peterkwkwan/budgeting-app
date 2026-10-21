import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/lib/auth';
import { statsKeys } from '@/lib/stats';
import {
  createTransaction,
  getTransaction,
  listTransactions,
  softDeleteTransaction,
  transactionKeys,
  updateTransaction,
  type TransactionInput,
} from '@/lib/transactions';

function invalidateLedgerAndStats(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  void queryClient.invalidateQueries({ queryKey: statsKeys.all });
}

/** List active transactions; refetch on screen focus for multi-device sync. */
export function useTransactionList() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: transactionKeys.list(),
    queryFn: listTransactions,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.list() });
    }, [queryClient])
  );

  return query;
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
