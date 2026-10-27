import { useEffect, useState } from 'react';

import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { subscribeConnectivity } from '@/lib/offline/net';

/**
 * Device online flag. While OFFLINE_TXNS_ENABLED is false this stays online
 * and does not subscribe to NetInfo.
 *
 * `ready` is false until the first NetInfo snapshot when the flag is on —
 * callers that would hang on a cold-offline RPC should wait or prefer local.
 */
export function useConnectivity(): { online: boolean; ready: boolean } {
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(!OFFLINE_TXNS_ENABLED);

  useEffect(() => {
    if (!OFFLINE_TXNS_ENABLED) return;

    return subscribeConnectivity((next) => {
      setOnline(next);
      setReady(true);
    });
  }, []);

  return {
    online: OFFLINE_TXNS_ENABLED ? online : true,
    ready,
  };
}
