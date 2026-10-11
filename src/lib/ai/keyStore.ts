import { useSyncExternalStore } from 'react';

/**
 * Gemini API key holder.
 *
 * Default: the key lives only in this module's memory and disappears when the
 * tab closes. If — and only if — the user opts in, it is also written to
 * localStorage under its own key so it survives reloads. Browser storage is
 * NOT an encrypted vault: anyone with access to this browser profile, a
 * malicious extension or injected script could read it. The key is never put
 * in backups, exports, logs, URLs or the service-worker cache.
 */
const REMEMBER_KEY = 'nutriledger.gemini.apiKey';

export interface KeyTestState {
  status: 'success' | 'failure';
  message: string;
  at: string;
  model: string;
}

export interface KeyState {
  apiKey: string | null;
  remembered: boolean;
  lastTest: KeyTestState | null;
}

function readRemembered(): string | null {
  try {
    const v = localStorage.getItem(REMEMBER_KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

const initial = readRemembered();
let state: KeyState = { apiKey: initial, remembered: initial !== null, lastTest: null };
const listeners = new Set<() => void>();

function set(next: KeyState) {
  state = next;
  for (const l of listeners) l();
}

export const keyStore = {
  get: (): KeyState => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Stores a key for this session, and on this device only if `remember` is true. */
  setKey(rawKey: string, remember: boolean) {
    const apiKey = rawKey.trim();
    if (!apiKey) throw new Error('Enter an API key.');
    let remembered = false;
    try {
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, apiKey);
        remembered = true;
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      remembered = false;
    }
    set({ apiKey, remembered, lastTest: null });
  },
  /** Forgets the key from memory and from device storage. */
  clearKey() {
    try {
      localStorage.removeItem(REMEMBER_KEY);
    } catch {
      // ignore
    }
    set({ apiKey: null, remembered: false, lastTest: null });
  },
  setTestResult(result: KeyTestState) {
    set({ ...state, lastTest: result });
  },
  /** Test helper. */
  reloadFromStorage() {
    const k = readRemembered();
    set({ apiKey: k, remembered: k !== null, lastTest: null });
  },
};

export function useKeyState(): KeyState {
  return useSyncExternalStore(keyStore.subscribe, keyStore.get, keyStore.get);
}

/** Masks a key for display, e.g. "AIza…x9Qk". Never render the full key. */
export function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export const REMEMBERED_KEY_STORAGE_NAME = REMEMBER_KEY;
