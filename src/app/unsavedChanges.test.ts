import { afterEach, describe, expect, it, vi } from 'vitest';
import { unsavedChanges } from './unsavedChanges';

afterEach(() => {
  unsavedChanges.resetForTests();
  vi.useRealTimers();
});

const fireBeforeUnload = () => {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

describe('unsaved changes registry', () => {
  it('guards page unload only while some form is dirty', () => {
    const a = Symbol('a');
    const b = Symbol('b');
    expect(fireBeforeUnload()).toBe(false);
    unsavedChanges.set(a, true);
    unsavedChanges.set(b, true);
    expect(unsavedChanges.has()).toBe(true);
    expect(fireBeforeUnload()).toBe(true);
    unsavedChanges.set(a, false);
    expect(fireBeforeUnload()).toBe(true);
    unsavedChanges.set(b, false);
    expect(unsavedChanges.has()).toBe(false);
    expect(fireBeforeUnload()).toBe(false);
  });

  it('notifies subscribers on changes', () => {
    const l = vi.fn();
    const off = unsavedChanges.subscribe(l);
    const t = Symbol('t');
    unsavedChanges.set(t, true);
    unsavedChanges.set(t, true); // no-op
    unsavedChanges.set(t, false);
    off();
    expect(l).toHaveBeenCalledTimes(2);
  });

  it('skips the browser prompt after an in-app confirmation, then re-arms', () => {
    vi.useFakeTimers();
    const t = Symbol('t');
    unsavedChanges.set(t, true);
    unsavedChanges.allowNextUnload();
    expect(fireBeforeUnload()).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(fireBeforeUnload()).toBe(true);
  });
});
