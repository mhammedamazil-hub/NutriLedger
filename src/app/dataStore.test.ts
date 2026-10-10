import { describe, expect, it } from 'vitest';
import { DataStore } from './dataStore';
import { createMemoryRepository } from '../lib/database/memory';
import { totalsFor } from '../lib/calculations/nutrition';
import type { FoodEntryInput } from '../types/models';

const input = (patch: Partial<FoodEntryInput> = {}): FoodEntryInput => ({
  date: '2026-10-10',
  meal: 'breakfast',
  name: 'Oats',
  quantity: 60,
  unit: 'g',
  calories: 230,
  protein: 8,
  carbs: 40,
  fat: 4,
  fiber: 6,
  notes: '',
  source: 'manual',
  ...patch,
});

async function readyStore() {
  const store = new DataStore(async () => createMemoryRepository());
  await store.init();
  return store;
}

describe('DataStore', () => {
  it('falls back to session memory when storage cannot open', async () => {
    const store = new DataStore(async () => {
      throw new Error('blocked');
    });
    await store.init();
    expect(store.getState().status).toBe('memory');
    expect(store.getState().storageMessage).toMatch(/lost when this tab closes/);
    await store.addFoodEntry(input());
    expect(store.getState().foodEntries).toHaveLength(1);
  });

  it('propagates create/update/delete to derived totals', async () => {
    const store = await readyStore();
    const a = await store.addFoodEntry(input({ calories: 200 }));
    await store.addFoodEntry(input({ calories: 300, name: 'Toast' }));
    expect(totalsFor(store.getState().foodEntries).calories).toBe(500);
    await store.updateFoodEntry(a.id, input({ calories: 250 }));
    expect(totalsFor(store.getState().foodEntries).calories).toBe(550);
    await store.deleteFoodEntry(a.id);
    expect(totalsFor(store.getState().foodEntries).calories).toBe(300);
  });

  it('gives every entry a unique id even for rapid identical submissions', async () => {
    const store = await readyStore();
    const results = await Promise.all([store.addFoodEntry(input()), store.addFoodEntry(input())]);
    expect(new Set(results.map((r) => r.id)).size).toBe(2);
  });

  it('rejects invalid entries without changing state', async () => {
    const store = await readyStore();
    await expect(store.addFoodEntry(input({ calories: -5 }))).rejects.toBeTruthy();
    await expect(store.addFoodEntry(input({ date: '2026-02-30' }))).rejects.toBeTruthy();
    expect(store.getState().foodEntries).toHaveLength(0);
  });

  it('does not update state when persistence fails', async () => {
    const repo = createMemoryRepository();
    repo.putFoodEntry = async () => {
      throw new Error('QuotaExceededError');
    };
    const store = new DataStore(async () => repo);
    await store.init();
    await expect(store.addFoodEntry(input())).rejects.toThrow();
    expect(store.getState().foodEntries).toHaveLength(0);
  });

  it('restores a deleted entry with its original id (undo)', async () => {
    const store = await readyStore();
    const a = await store.addFoodEntry(input());
    const removed = await store.deleteFoodEntry(a.id);
    expect(removed).toBeDefined();
    await store.restoreFoodEntry(removed!);
    expect(store.getState().foodEntries.map((e) => e.id)).toEqual([a.id]);
  });

  it('saves assessments as new records rather than overwriting', async () => {
    const store = await readyStore();
    const base = {
      date: '2026-10-10',
      inputs: {
        age: 30,
        sex: 'male' as const,
        heightCm: 180,
        weightKg: 80,
        activity: 'light' as const,
        neckCm: null,
        waistCm: null,
        hipCm: null,
      },
      results: {
        equation: 'mifflin-st-jeor' as const,
        bmr: 1780,
        activityMultiplier: 1.375,
        tdee: 2447.5,
        bodyFatPercent: null,
        leanMassKg: null,
        katchMcArdleBmr: null,
        katchMcArdleTdee: null,
      },
      notes: '',
    };
    await store.saveAssessment(base);
    await store.saveAssessment(base);
    expect(store.getState().assessments).toHaveLength(2);
  });
});
