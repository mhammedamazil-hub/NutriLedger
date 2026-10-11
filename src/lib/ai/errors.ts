/**
 * Maps any failure from the Gemini SDK, the network or our own validation to
 * a small set of user-facing kinds. Messages are written by us — raw provider
 * messages, request bodies and the API key are never shown or logged.
 */
export type AiErrorKind =
  | 'missing-key'
  | 'offline'
  | 'invalid-key'
  | 'permission'
  | 'model-unavailable'
  | 'quota'
  | 'rate-limit'
  | 'service-unavailable'
  | 'bad-request'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'safety'
  | 'malformed'
  | 'empty'
  | 'unknown';

export class AiError extends Error {
  override name = 'AiError';
  readonly kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string = AI_ERROR_MESSAGES[kind]) {
    super(message);
    this.kind = kind;
  }
}

export const AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  'missing-key': 'Add your Gemini API key in Settings to use AI features.',
  offline: 'You appear to be offline. AI features need an internet connection; everything else keeps working.',
  'invalid-key': 'Google rejected the API key. Check that it was copied correctly, or create a new key in Google AI Studio.',
  permission:
    'This key is not allowed to use the Gemini API (the API may be disabled for the project, or the service is unavailable in your region).',
  'model-unavailable':
    'The selected model is not available for this key. Choose a different model in Settings and test the connection.',
  quota: 'Your Gemini usage quota is used up. Check your plan and limits in Google AI Studio, or try again later.',
  'rate-limit': 'Too many requests in a short time. Wait a minute and try again.',
  'service-unavailable': 'The Gemini service is temporarily unavailable. Try again shortly.',
  'bad-request': 'Gemini could not process this request. Try shortening or rephrasing it.',
  network: 'Could not reach Google’s servers. Check your connection and try again.',
  timeout: 'The request took too long and was stopped. Try again.',
  cancelled: 'Request cancelled.',
  safety: 'Gemini declined to answer this request for safety reasons. Try rephrasing it.',
  malformed: 'Gemini’s reply could not be understood or failed validation, so it was not used. You can retry or enter values manually.',
  empty: 'Gemini returned an empty reply. Try again.',
  unknown: 'Something went wrong with the AI request. Your input has been kept; try again.',
};

export const RETRYABLE_KINDS: ReadonlySet<AiErrorKind> = new Set(['service-unavailable']);

interface MaybeApiError {
  name?: unknown;
  status?: unknown;
  message?: unknown;
}

export function classifyAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  const e = (typeof err === 'object' && err !== null ? err : {}) as MaybeApiError;
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : '';
  const status = typeof e.status === 'number' ? e.status : undefined;

  if (name === 'AbortError') return new AiError('cancelled');
  if (status !== undefined) {
    if (status === 400) {
      if (/api[_ ]?key/i.test(message)) return new AiError('invalid-key');
      if (/location|region|country/i.test(message)) return new AiError('permission');
      return new AiError('bad-request');
    }
    if (status === 401) return new AiError('invalid-key');
    if (status === 403) {
      if (/api[_ ]?key.*(invalid|not valid|expired)/i.test(message)) return new AiError('invalid-key');
      return new AiError('permission');
    }
    if (status === 404) return new AiError('model-unavailable');
    if (status === 408) return new AiError('timeout');
    if (status === 429) {
      if (/per.?day|perday|billing|plan|exceeded your current quota|free.?tier/i.test(message)) {
        return new AiError('quota');
      }
      return new AiError('rate-limit');
    }
    if (status >= 500) return new AiError('service-unavailable');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new AiError('offline');
  if (name === 'TypeError' || /fetch|network|load failed/i.test(message)) return new AiError('network');
  return new AiError('unknown');
}
