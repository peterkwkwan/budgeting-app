/**
 * Client UUID for offline creates (and outbox row ids).
 * Uses Web Crypto when available so this module has no Expo dependency and
 * stays in the same JS bundle as the offline write path (no Metro fetch).
 */
export function newClientId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  // Fallback for runtimes without Web Crypto (should not hit on device).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const nibble = (Math.random() * 16) | 0;
    const value = ch === 'x' ? nibble : (nibble & 0x3) | 0x8;
    return value.toString(16);
  });
}
