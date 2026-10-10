import { describe, expect, it } from 'vitest';
import { isQuotaError, QUOTA_MESSAGE, saveErrorMessage } from './errors';

describe('storage error classification', () => {
  it('recognises quota errors from different browsers and wrapped transaction aborts', () => {
    expect(isQuotaError(new DOMException('full', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    const abort = Object.assign(new DOMException('aborted', 'AbortError'), { error: new DOMException('full', 'QuotaExceededError') });
    expect(isQuotaError(abort)).toBe(true);
  });

  it('does not misclassify other failures', () => {
    expect(isQuotaError(new DOMException('aborted', 'AbortError'))).toBe(false);
    expect(isQuotaError(new Error('QuotaExceededError'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError('QuotaExceededError')).toBe(false);
  });

  it('uses the quota message or the caller fallback, never raw error text', () => {
    expect(saveErrorMessage(new DOMException('secret record text', 'QuotaExceededError'), 'fallback')).toBe(QUOTA_MESSAGE);
    expect(saveErrorMessage(new Error('secret record text'), 'fallback')).toBe('fallback');
    expect(QUOTA_MESSAGE).toMatch(/Nothing was changed/);
  });
});
