import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import type { Preferences } from '../types/models';
import { DEFAULT_MODEL_ID, isSupportedModel } from '../lib/ai/models';

/** Small, non-sensitive UI preferences live in localStorage. */
const STORAGE_KEY = 'nutriledger.preferences.v1';

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  units: 'metric',
  aiModel: DEFAULT_MODEL_ID,
};

const prefsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).catch('system'),
  units: z.enum(['metric', 'imperial']).catch('metric'),
  aiModel: z
    .string()
    .catch(DEFAULT_MODEL_ID)
    .transform((m) => (isSupportedModel(m) ? m : DEFAULT_MODEL_ID)),
});

function read(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = prefsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : { ...DEFAULT_PREFERENCES };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

let current: Preferences = read();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const preferencesStore = {
  get: (): Preferences => current,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  update(patch: Partial<Preferences>) {
    current = { ...current, ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Storage full or blocked: preference still applies for this session.
    }
    emit();
  },
  reset() {
    current = { ...DEFAULT_PREFERENCES };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    emit();
  },
  /** Test helper: re-read from storage. */
  reloadFromStorage() {
    current = read();
    emit();
  },
};

export function usePreferences(): Preferences {
  return useSyncExternalStore(preferencesStore.subscribe, preferencesStore.get, preferencesStore.get);
}
