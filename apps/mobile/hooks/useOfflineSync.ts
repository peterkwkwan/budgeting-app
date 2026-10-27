import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth';
import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { syncNow } from '@/lib/offline/syncEngine';
import { transactionKeys } from '@/lib/transactions';

/**
 * Foreground and reconnect sync. No-op while OFFLINE_TXNS_ENABLED is false,
 * so NetInfo is not subscribed and the device DB is not opened.
 */
export function useOfflineTransactionSync() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!OFFLINE_TXNS_ENABLED || !userId) return;

    let cancelled = false;
    let inFlight = false;
    let again = false;
    let unsubNet = () => {};

    const run = () => {
      if (cancelled) return;
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      void syncNow(userId)
        .then((result) => {
          if (cancelled || result.skipped) return;
          if (result.pushed > 0 || result.pulled > 0 || result.dropped > 0) {
            void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
          }
          if (result.failed > 0) {
            console.warn('[offline] sync push failed', result.failed);
          }
        })
        .catch((err) => {
          console.warn('[offline] sync failed', err);
        })
        .finally(() => {
          inFlight = false;
          if (again && !cancelled) {
            again = false;
            run();
          }
        });
    };

    run();

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') run();
    };
    const appSub = AppState.addEventListener('change', onChange);

    void import('@/lib/offline/net').then((net) => {
      if (cancelled) return;
      unsubNet = net.subscribeOnline(() => run());
    });

    return () => {
      cancelled = true;
      appSub.remove();
      unsubNet();
    };
  }, [userId, queryClient]);
}
