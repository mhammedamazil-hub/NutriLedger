import { afterEach, describe, expect, it } from 'vitest';
import { preferencesStore } from './preferences';
import { DEFAULT_MODEL_ID, SUPPORTED_MODELS } from '../lib/ai/models';

const KEY = 'nutriledger.preferences.v1';

afterEach(() => preferencesStore.reset());

describe('preferences', () => {
  it('migrates a saved model that is no longer offered (deprecated gemini-3.5-flash) to the default', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'dark', units: 'imperial', aiModel: 'gemini-3.5-flash' }));
    preferencesStore.reloadFromStorage();
    const p = preferencesStore.get();
    expect(p.aiModel).toBe(DEFAULT_MODEL_ID);
    // Other preferences are kept.
    expect(p.theme).toBe('dark');
    expect(p.units).toBe('imperial');
  });

  it('keeps a saved model that is still offered', () => {
    localStorage.setItem(KEY, JSON.stringify({ aiModel: 'gemini-3.5-flash-lite' }));
    preferencesStore.reloadFromStorage();
    expect(preferencesStore.get().aiModel).toBe('gemini-3.5-flash-lite');
  });

  it('falls back to defaults for corrupted storage', () => {
    localStorage.setItem(KEY, '{not json');
    preferencesStore.reloadFromStorage();
    expect(preferencesStore.get().aiModel).toBe(DEFAULT_MODEL_ID);
  });

  it('offers only distinct models, with the default among them and no deprecated IDs', () => {
    const ids = SUPPORTED_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_MODEL_ID);
    expect(ids).not.toContain('gemini-3.5-flash');
  });
});
