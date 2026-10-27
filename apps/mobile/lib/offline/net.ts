/**
 * Online / offline signal for the transactions sync engine.
 * Loaded only when OFFLINE_TXNS_ENABLED is true.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/** Connected, and not known to be unreachable. Unknown reachability still counts as online. */
export function isStateOnline(state: NetInfoState): boolean {
  if (state.isConnected !== true) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export async function isDeviceOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isStateOnline(state);
}

/**
 * Calls `onOnline` when NetInfo transitions from offline to online.
 * The first snapshot does not fire, so mount can sync on its own.
 */
export function subscribeOnline(onOnline: () => void): () => void {
  let previous: boolean | null = null;
  return NetInfo.addEventListener((state) => {
    const online = isStateOnline(state);
    if (online && previous === false) onOnline();
    previous = online;
  });
}
