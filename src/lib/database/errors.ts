/**
 * User-facing messages for failed local writes. Messages never include raw
 * error text (which can contain record contents) — only a classification.
 */

/** True when the browser refused a write because the site's storage quota is exhausted. */
export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; error?: unknown };
  if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  // idb / IndexedDB transactions surface the cause on `.error` when aborted.
  if (e.name === 'AbortError' && e.error) return isQuotaError(e.error);
  return false;
}

export const QUOTA_MESSAGE =
  'Your device has run out of storage space for NutriLedger, so this could not be saved. Nothing was changed. Free up space on the device (or export a backup and delete old records), then try again.';

/** Returns a specific message for storage-full errors, otherwise the given fallback. */
export function saveErrorMessage(err: unknown, fallback: string): string {
  return isQuotaError(err) ? QUOTA_MESSAGE : fallback;
}
