/**
 * Ignore rapid repeat navigations to the same href (double-tap Add → stacked screens).
 */

type Pushable = { push: (href: string) => void };

const lastPushAt = new Map<string, number>();

const DEFAULT_COOLDOWN_MS = 500;

/** Returns true if this push should proceed. */
export function canPushNow(
  href: string,
  cooldownMs = DEFAULT_COOLDOWN_MS
): boolean {
  const now = Date.now();
  const last = lastPushAt.get(href) ?? 0;
  if (now - last < cooldownMs) return false;
  lastPushAt.set(href, now);
  return true;
}

/** `router.push` only if the same href wasn’t pushed within the cooldown. */
export function guardedPush(
  router: Pushable,
  href: string,
  cooldownMs = DEFAULT_COOLDOWN_MS
): void {
  if (!canPushNow(href, cooldownMs)) return;
  router.push(href);
}
