import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useConnectivity } from '@/hooks/useConnectivity';
import { useAuth } from '@/lib/auth';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
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
  const { online, ready } = useConnectivity();
  const queryClient = useQueryClient();
  // Partner RPC never settles offline after a cold boot — skip until online.
  const canFetch =
    Boolean(session) &&
    (!OFFLINE_TXNS_ENABLED || (ready && online));

  const query = useQuery({
    queryKey: partnerKeys.link(),
    queryFn: fetchPartnerLink,
    enabled: canFetch,
  });

  useFocusEffect(
    useCallback(() => {
      if (!canFetch) return;
      void queryClient.invalidateQueries({ queryKey: partnerKeys.link() });
    }, [queryClient, canFetch])
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
