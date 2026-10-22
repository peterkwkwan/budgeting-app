import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/lib/auth';
import {
  catchUpRecurring,
  createRecurringSeries,
  getRecurringSeries,
  listRecurringSeries,
  recurringKeys,
  stopRecurringSeries,
  updateRecurringSeriesFuture,
  type RecurringSeriesInput,
  type RecurringSeriesUpdateInput,
} from '@/lib/recurring';
import { statsKeys } from '@/lib/stats';
import { transactionKeys } from '@/lib/transactions';

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: recurringKeys.all });
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  void queryClient.invalidateQueries({ queryKey: statsKeys.all });
}

export function useRecurringList() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: recurringKeys.list(),
    queryFn: listRecurringSeries,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: recurringKeys.list() });
    }, [queryClient])
  );

  return query;
}

export function useRecurringSeries(id: string | undefined) {
  return useQuery({
    queryKey: recurringKeys.detail(id ?? ''),
    queryFn: () => getRecurringSeries(id!),
    enabled: Boolean(id),
  });
}

export function useCreateRecurringSeries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecurringSeriesInput) => {
      if (!user?.id) {
        throw new Error('You must be signed in to add a recurring rule.');
      }
      const series = await createRecurringSeries(user.id, input);
      // Fill the rolling window immediately so ledger updates without waiting for cron.
      // Soft-fail if the Edge Function is not deployed yet.
      const catchUp = await catchUpRecurring();
      if (!catchUp.ok) {
        console.warn('[recurring] catch-up after create failed', catchUp.error);
      }
      return series;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
    },
  });
}

export function useUpdateRecurringSeries(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecurringSeriesUpdateInput) =>
      updateRecurringSeriesFuture(id, input),
    onSuccess: () => {
      invalidateAll(queryClient);
    },
  });
}

export function useStopRecurringSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stopRecurringSeries(id),
    onSuccess: () => {
      invalidateAll(queryClient);
    },
  });
}
