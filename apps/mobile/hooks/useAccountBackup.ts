import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteMyAccount,
  getAccountBackupStatus,
  restoreMyData,
  wipeMyData,
  type AccountBackupStatus,
} from '@/lib/accountData';
import { useAuth } from '@/lib/auth';
import { partnerKeys } from '@/lib/partner';
import { plannerGoalKeys } from '@/lib/plannerGoals';
import { plannerVehicleKeys } from '@/lib/plannerVehicles';
import { recurringKeys } from '@/lib/recurring';
import { statsKeys } from '@/lib/stats';
import { transactionKeys } from '@/lib/transactions';

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

export function useWipeMyData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: wipeMyData,
    onSuccess: (result) => {
      queryClient.setQueryData<AccountBackupStatus>(accountBackupKeys.status(), {
        hasBackup: true,
        wipedAt: result.wipedAt,
        expiresAt: result.expiresAt,
        restoreAvailable: true,
      });
      invalidateAllProductQueries(queryClient);
    },
  });
}

export function useRestoreMyData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreMyData,
    onSuccess: () => {
      queryClient.setQueryData<AccountBackupStatus>(accountBackupKeys.status(), {
        hasBackup: false,
        wipedAt: null,
        expiresAt: null,
        restoreAvailable: false,
      });
      invalidateAllProductQueries(queryClient);
    },
  });
}

export function useDeleteMyAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
