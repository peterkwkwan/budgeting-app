import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { useAuth } from '@/lib/auth';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import {
  bulkPatchLocalTransactions,
  createLocalTransaction,
  getLocalTransaction,
  listLocalTransactions,
  softDeleteLocalTransaction,
  softDeleteLocalTransactions,
  updateLocalTransaction,
} from '@/lib/offline/transactionsRepo';
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

/** Online path only invalidates. Flag on: also push then pull. */
function settleTransactionWrite(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateTransactionsAndStats(queryClient);
  if (!OFFLINE_TXNS_ENABLED) return;
  void signedInUserId()
    .then(async (userId) => {
      const { syncNow } = await import('@/lib/offline/syncEngine');
      return syncNow(userId);
    })
    .then((result) => {
      if (
        !result.skipped &&
        (result.pushed > 0 || result.pulled > 0 || result.dropped > 0)
      ) {
        invalidateTransactionsAndStats(queryClient);
      }
    })
    .catch((err) => {
      console.warn('[offline] sync after write failed', err);
    });
}

/** Signed-in user id for the offline repository. Not called while the flag is off. */
async function signedInUserId(): Promise<string> {
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You must be signed in.');
  return userId;
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
    // Flag off: same stable listTransactions reference as the online path.
    queryFn: OFFLINE_TXNS_ENABLED
      ? () => signedInUserId().then((userId) => listLocalTransactions(userId))
      : listTransactions,
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
    queryFn: () =>
      OFFLINE_TXNS_ENABLED
        ? signedInUserId().then((userId) => getLocalTransaction(userId, id!))
        : getTransaction(id!),
    enabled: Boolean(id),
  });
}

export function useCreateTransaction() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransactionInput) => {
      if (!user?.id) {
        throw new Error('You must be signed in to add a transaction.');
      }
      if (OFFLINE_TXNS_ENABLED) {
        return createLocalTransaction(
          user.id,
          input,
          profile?.currency ?? 'HKD'
        );
      }
      return createTransaction(
        user.id,
        input,
        profile?.currency ?? 'HKD'
      );
    },
    onSuccess: () => {
      settleTransactionWrite(queryClient);
    },
  });
}

export function useUpdateTransaction(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransactionInput) => {
      if (OFFLINE_TXNS_ENABLED) {
        return signedInUserId().then((userId) =>
          updateLocalTransaction(userId, id, input)
        );
      }
      return updateTransaction(id, input);
    },
    onSuccess: () => {
      settleTransactionWrite(queryClient);
    },
  });
}

export function useSoftDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (txnId: string) => {
      if (OFFLINE_TXNS_ENABLED) {
        return signedInUserId().then((userId) =>
          softDeleteLocalTransaction(userId, txnId)
        );
      }
      return softDeleteTransaction(txnId);
    },
    onSuccess: () => {
      settleTransactionWrite(queryClient);
    },
  });
}

export function useBulkSoftDeleteTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => {
      if (OFFLINE_TXNS_ENABLED) {
        return signedInUserId().then((userId) =>
          softDeleteLocalTransactions(userId, ids)
        );
      }
      return softDeleteTransactions(ids);
    },
    onSuccess: () => {
      settleTransactionWrite(queryClient);
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
    }) => {
      if (OFFLINE_TXNS_ENABLED) {
        return signedInUserId().then((userId) =>
          bulkPatchLocalTransactions(userId, rows, patch)
        );
      }
      return bulkPatchTransactions(rows, patch);
    },
    onSuccess: () => {
      settleTransactionWrite(queryClient);
    },
  });
}
