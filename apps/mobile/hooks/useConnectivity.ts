import { useEffect, useState } from 'react';

import { OFFLINE_TXNS_ENABLED } from '@/lib/offline/flag';
import { subscribeConnectivity } from '@/lib/offline/net';

/**
 * Device online flag. While OFFLINE_TXNS_ENABLED is false this stays online
 * and does not subscribe to NetInfo.
 */
export function useConnectivity(): { online: boolean } {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!OFFLINE_TXNS_ENABLED) return;

    return subscribeConnectivity(setOnline);
  }, []);

  return { online: OFFLINE_TXNS_ENABLED ? online : true };
}
