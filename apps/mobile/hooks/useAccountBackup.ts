import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteMyAccount,
  getAccountBackupStatus,
  restoreMyData,
  wipeMyData,
  type AccountBackupStatus,
} from '@/lib/accountData';
import { useAuth } from '@/lib/auth';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { logOffline } from '@/lib/offline/log';
import { offlineUxKeys } from '@/lib/offline/ux';
import { partnerKeys } from '@/lib/partner';
import { plannerGoalKeys } from '@/lib/plannerGoals';
import { plannerVehicleKeys } from '@/lib/plannerVehicles';
import { recurringKeys } from '@/lib/recurring';
import { statsKeys } from '@/lib/stats';
import { transactionKeys } from '@/lib/transactions';
import { userCategoryKeys } from '@/lib/userCategories';

export const accountBackupKeys = {
  all: ['account-backup'] as const,
  status: () => [...accountBackupKeys.all, 'status'] as const,
};

/** Invalidate every product query after wipe / restore / delete. */
export function invalidateAllProductQueries(
  queryClient: ReturnType<typeof useQueryClient>
) {
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  void queryClient.invalidateQueries({ queryKey: statsKeys.all });
  void queryClient.invalidateQueries({ queryKey: recurringKeys.all });
  void queryClient.invalidateQueries({ queryKey: partnerKeys.all });
  void queryClient.invalidateQueries({ queryKey: plannerGoalKeys.all });
  void queryClient.invalidateQueries({ queryKey: plannerVehicleKeys.all });
  void queryClient.invalidateQueries({ queryKey: userCategoryKeys.all });
  void queryClient.invalidateQueries({ queryKey: accountBackupKeys.all });
}

export function useAccountBackupStatus() {
  const { session } = useAuth();
  return useQuery({
    queryKey: accountBackupKeys.status(),
    queryFn: getAccountBackupStatus,
    enabled: Boolean(session),
  });
}

async function clearLocalIfEnabled(userId: string | undefined): Promise<void> {
  if (!OFFLINE_TXNS_ENABLED || !userId) return;
  const { clearOfflineUser } = await import('@/lib/offline/syncEngine');
  await clearOfflineUser(userId);
}

async function resetAndPullIfEnabled(userId: string | undefined): Promise<void> {
  if (!OFFLINE_TXNS_ENABLED || !userId) return;
  const { resetLocalAndFullPull } = await import('@/lib/offline/syncEngine');
  await resetLocalAndFullPull(userId);
}

function invalidateOfflineUx(
  queryClient: ReturnType<typeof useQueryClient>
): void {
  if (!OFFLINE_TXNS_ENABLED) return;
  void queryClient.invalidateQueries({ queryKey: offlineUxKeys.all });
}

export function useWipeMyData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: wipeMyData,
    onSuccess: async (result) => {
      try {
        await clearLocalIfEnabled(user?.id);
      } catch {
        logOffline('wipe clear failed', { op: 'clear' });
      }
      queryClient.setQueryData<AccountBackupStatus>(accountBackupKeys.status(), {
        hasBackup: true,
        wipedAt: result.wipedAt,
        expiresAt: result.expiresAt,
        restoreAvailable: true,
      });
      invalidateAllProductQueries(queryClient);
      invalidateOfflineUx(queryClient);
    },
  });
}

export function useRestoreMyData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: restoreMyData,
    onSuccess: async () => {
      try {
        await resetAndPullIfEnabled(user?.id);
      } catch {
        logOffline('restore pull failed', { op: 'pull' });
      }
      queryClient.setQueryData<AccountBackupStatus>(accountBackupKeys.status(), {
        hasBackup: false,
        wipedAt: null,
        expiresAt: null,
        restoreAvailable: false,
      });
      invalidateAllProductQueries(queryClient);
      invalidateOfflineUx(queryClient);
    },
  });
}

export function useDeleteMyAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: async () => {
      try {
        await clearLocalIfEnabled(user?.id);
      } catch {
        logOffline('delete-account clear failed', { op: 'clear' });
      }
      queryClient.clear();
    },
  });
}
