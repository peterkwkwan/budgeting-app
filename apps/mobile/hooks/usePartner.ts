import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/lib/auth';
import {
  acceptPartnerInvite,
  createPartnerInvite,
  fetchPartnerLink,
  partnerKeys,
  unlinkPartner,
} from '@/lib/partner';
import { statsKeys } from '@/lib/stats';

export function usePartnerLink() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: partnerKeys.link(),
    queryFn: fetchPartnerLink,
    enabled: Boolean(session),
  });

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      void queryClient.invalidateQueries({ queryKey: partnerKeys.link() });
    }, [queryClient, session])
  );

  return query;
}

function invalidatePartnerAndStats(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: partnerKeys.all });
  void queryClient.invalidateQueries({ queryKey: statsKeys.all });
}

export function useCreatePartnerInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPartnerInvite,
    onSuccess: () => invalidatePartnerAndStats(queryClient),
  });
}

export function useAcceptPartnerInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => acceptPartnerInvite(code),
    onSuccess: () => invalidatePartnerAndStats(queryClient),
  });
}

export function useUnlinkPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkPartner,
    onSuccess: () => invalidatePartnerAndStats(queryClient),
  });
}
