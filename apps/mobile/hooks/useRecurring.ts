import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/lib/auth';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { refuseOfflineSeriesChange } from '@/lib/offline/seriesGuard';
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

/** New instances from an online create. Push-then-pull; does not drop the outbox. */
async function pullAfterSeriesCreate(userId: string | undefined): Promise<void> {
  if (!OFFLINE_TXNS_ENABLED || !userId) return;
  try {
    const { syncNow } = await import('@/lib/offline/syncEngine');
    await syncNow(userId);
  } catch (err) {
    console.warn('[offline] series pull failed', err);
  }
}

/**
 * Stop and edit-future can hard-delete future instances.
 * Full reset only after a clean push, so a failed outbox is not discarded.
 */
async function resyncAfterSeriesChange(userId: string | undefined): Promise<void> {
  if (!OFFLINE_TXNS_ENABLED || !userId) return;
  try {
    const { resyncAfterSeriesHardDelete } = await import('@/lib/offline/syncEngine');
    await resyncAfterSeriesHardDelete(userId);
  } catch (err) {
    console.warn('[offline] series resync failed', err);
  }
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
      await refuseOfflineSeriesChange();
      const series = await createRecurringSeries(user.id, input);
      // Fill the rolling window immediately so Transactions updates without waiting for cron.
      // Soft-fail if the Edge Function is not deployed yet.
      const catchUp = await catchUpRecurring();
      if (!catchUp.ok) {
        console.warn('[recurring] catch-up after create failed', catchUp.error);
      }
      return series;
    },
    onSuccess: async () => {
      await pullAfterSeriesCreate(user?.id);
      invalidateAll(queryClient);
    },
  });
}

export function useUpdateRecurringSeries(id: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: RecurringSeriesUpdateInput) => {
      await refuseOfflineSeriesChange();
      return updateRecurringSeriesFuture(id, input);
    },
    onSuccess: async () => {
      await resyncAfterSeriesChange(user?.id);
      invalidateAll(queryClient);
    },
  });
}

export function useStopRecurringSeries() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      await refuseOfflineSeriesChange();
      return stopRecurringSeries(id);
    },
    onSuccess: async () => {
      await resyncAfterSeriesChange(user?.id);
      invalidateAll(queryClient);
    },
  });
}
