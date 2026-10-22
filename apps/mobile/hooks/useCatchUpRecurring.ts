import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/lib/auth';
import { catchUpRecurring, recurringKeys } from '@/lib/recurring';
import { statsKeys } from '@/lib/stats';
import { transactionKeys } from '@/lib/transactions';

/**
 * On sign-in and each return to foreground, ask the server to fill missing
 * recurring instances for this user (covers missed cron).
 */
export function useCatchUpRecurring() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!session) return;

    async function run() {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const result = await catchUpRecurring();
        if (result.ok && (result.inserted ?? 0) > 0) {
          void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
          void queryClient.invalidateQueries({ queryKey: statsKeys.all });
          void queryClient.invalidateQueries({ queryKey: recurringKeys.all });
        }
      } catch (err) {
        console.warn('[recurring] catch-up failed', err);
      } finally {
        inFlight.current = false;
      }
    }

    void run();

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void run();
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
    };
  }, [session, queryClient]);
}
