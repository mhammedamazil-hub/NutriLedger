/**
 * Tracks forms that hold unsaved input, so app-level actions (installing an
 * update, closing the tab) never discard a user's typing silently.
 */
const dirtyForms = new Set<symbol>();
const listeners = new Set<() => void>();
/** Set briefly after the user explicitly confirmed a reload in the app, so the browser doesn't ask twice. */
let unloadAllowed = false;
let rearmTimer: ReturnType<typeof setTimeout> | undefined;

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  // Legacy browsers require a returnValue to show the prompt.
  e.returnValue = '';
}

function sync() {
  if (typeof window !== 'undefined') {
    if (dirtyForms.size > 0 && !unloadAllowed) window.addEventListener('beforeunload', onBeforeUnload);
    else window.removeEventListener('beforeunload', onBeforeUnload);
  }
  for (const l of listeners) l();
}

export const unsavedChanges = {
  set(token: symbol, dirty: boolean) {
    const had = dirtyForms.has(token);
    if (dirty === had) return;
    if (dirty) dirtyForms.add(token);
    else dirtyForms.delete(token);
    sync();
  },
  has: (): boolean => dirtyForms.size > 0,
  /**
   * The user already confirmed discarding unsaved input in the app (e.g. "Update
   * anyway"): skip the browser's own leave-page prompt for the coming reload.
   * Re-arms after 10 s in case no reload happens.
   */
  allowNextUnload() {
    unloadAllowed = true;
    sync();
    clearTimeout(rearmTimer);
    rearmTimer = setTimeout(() => {
      unloadAllowed = false;
      sync();
    }, 10_000);
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Test helper. */
  resetForTests() {
    dirtyForms.clear();
    unloadAllowed = false;
    clearTimeout(rearmTimer);
    sync();
  },
};
