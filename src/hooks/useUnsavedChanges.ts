import { useEffect, useState, useSyncExternalStore } from 'react';
import { unsavedChanges } from '../app/unsavedChanges';

/** Registers the calling form as holding unsaved input while `dirty` is true. */
export function useUnsavedChanges(dirty: boolean): void {
  const [token] = useState(() => Symbol('form'));
  useEffect(() => {
    unsavedChanges.set(token, dirty);
  }, [token, dirty]);
  useEffect(() => () => unsavedChanges.set(token, false), [token]);
}

/** True while any form in the app holds unsaved input. */
export function useHasUnsavedChanges(): boolean {
  return useSyncExternalStore(unsavedChanges.subscribe, unsavedChanges.has, unsavedChanges.has);
}
