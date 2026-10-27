/**
 * Map raw offline-write failures to copy that is safe to show in the UI.
 * Metro's "Could not load bundle" is a packager/network problem, not SQLite.
 */

const BUNDLE_FETCH =
  /could not load bundle|loading module|failed to fetch|network request failed|the internet connection appears to be offline/i;

export function userFacingOfflineWriteError(
  err: unknown,
  fallback: string
): string {
  const message = err instanceof Error ? err.message.trim() : '';
  if (message && BUNDLE_FETCH.test(message)) {
    return (
      'Could not finish offline save. Keep this screen open without reloading, ' +
      'or use a release/dev-client build that embeds the JS bundle.'
    );
  }
  if (message) return message;
  return fallback;
}
