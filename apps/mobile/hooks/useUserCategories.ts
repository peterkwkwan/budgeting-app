import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TransactionType } from '@/constants/categories';
import { useAuth } from '@/lib/auth';
import { recurringKeys } from '@/lib/recurring';
import { statsKeys } from '@/lib/stats';
import { transactionKeys } from '@/lib/transactions';
import {
  archiveUserCategory,
  createUserCategory,
  listUserCategories,
  renameUserCategory,
  unarchiveUserCategory,
  userCategoryKeys,
} from '@/lib/userCategories';

export function useUserCategories() {
  const { session } = useAuth();
  return useQuery({
    queryKey: userCategoryKeys.list(),
    queryFn: listUserCategories,
    enabled: Boolean(session),
  });
}

export function useCreateUserCategory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: TransactionType; name: string }) => {
      if (!user?.id) throw new Error('Not signed in.');
      return createUserCategory(user.id, input.type, input.name);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userCategoryKeys.all });
    },
  });
}

export function useRenameUserCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      renameUserCategory(input.id, input.name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userCategoryKeys.all });
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      void queryClient.invalidateQueries({ queryKey: statsKeys.all });
    },
  });
}

export function useArchiveUserCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveUserCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userCategoryKeys.all });
    },
  });
}

export function useUnarchiveUserCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unarchiveUserCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userCategoryKeys.all });
    },
  });
}
