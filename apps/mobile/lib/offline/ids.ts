import * as Crypto from 'expo-crypto';

/**
 * Client UUID for offline creates (and outbox row ids).
 * Uses existing `expo-crypto` — no new dependency.
 */
export function newClientId(): string {
  return Crypto.randomUUID();
}
