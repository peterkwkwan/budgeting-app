import { useEffect, useState } from 'react';

import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';

/**
 * Device online flag. While OFFLINE_TXNS_ENABLED is false this stays online
 * and does not subscribe to NetInfo.
 */
export function useConnectivity(): { online: boolean } {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!OFFLINE_TXNS_ENABLED) return;

    let cancelled = false;
    let unsub = () => {};

    void import('@/lib/offline/net').then((net) => {
      if (cancelled) return;
      unsub = net.subscribeConnectivity((next) => {
        if (!cancelled) setOnline(next);
      });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { online: OFFLINE_TXNS_ENABLED ? online : true };
}
