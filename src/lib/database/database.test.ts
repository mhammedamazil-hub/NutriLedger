import { afterEach, describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import { createIndexedDbRepository, DB_VERSION, openNutriDb } from './indexedDb';
import { createMemoryRepository } from './memory';
import { makeAssessment, makeEntry, makeWeight } from '../../test/factories';
import { totalsFor } from '../calculations/nutrition';
import type { Repository } from './types';
import { EMPTY_PROFILE } from '../../types/models';

let counter = 0;
const repos: Repository[] = [];
async function freshRepo(): Promise<{ repo: Repository; name: string }> {
  counter += 1;
  const name = `nl-test-${counter}-${Math.random().toString(36).slice(2)}`;
  const repo = await createIndexedDbRepository(name);
  repos.push(repo);
  return { repo, name };
}

afterEach(() => {
  while (repos.length) repos.pop()?.close();
});

describe('IndexedDB repository', () => {
  it('creates the schema with all stores and date indexes', async () => {
    const { name, repo } = await freshRepo();
    repo.close();
    const db = await openNutriDb(name);
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['assessments', 'foodEntries', 'settings', 'weights']);
    expect([...db.transaction('foodEntries').store.indexNames]).toContain('by-date');
    db.close();
  });

  it('opens an existing database without destroying its records (upgrade safety)', async () => {
    const { name, repo } = await freshRepo();
    await repo.putFoodEntry(makeEntry({ id: 'keep-me' }));
    repo.close();
    const again = await createIndexedDbRepository(name);
    repos.push(again);
    const { snapshot } = await again.loadAll();
    expect(snapshot.foodEntries.map((e) => e.id)).toEqual(['keep-me']);
  });

  it('performs create, read, update and delete', async () => {
    const { repo } = await freshRepo();
    const e = makeEntry({ id: 'x1', calories: 300 });
    await repo.putFoodEntry(e);
    let snap = (await repo.loadAll()).snapshot;
    expect(snap.foodEntries).toHaveLength(1);

    await repo.putFoodEntry({ ...e, calories: 450 });
    snap = (await repo.loadAll()).snapshot;
    expect(snap.foodEntries).toHaveLength(1);
    expect(totalsFor(snap.foodEntries).calories).toBe(450);

    await repo.deleteFoodEntry('x1');
    snap = (await repo.loadAll()).snapshot;
    expect(snap.foodEntries).toHaveLength(0);
  });

  it('deletes many records in one transaction and ignores unknown IDs', async () => {
    const { repo } = await freshRepo();
    for (const id of ['a', 'b', 'c']) await repo.putFoodEntry(makeEntry({ id }));
    await repo.putWeight(makeWeight({ id: 'w1' }));
    await repo.deleteMany('foodEntries', ['a', 'c', 'missing']);
    const snap = (await repo.loadAll()).snapshot;
    expect(snap.foodEntries.map((e) => e.id)).toEqual(['b']);
    expect(snap.weights).toHaveLength(1);
  });

  it('stores assessments, weights and settings', async () => {
    const { repo } = await freshRepo();
    await repo.putAssessment(makeAssessment({ id: 'a' }));
    await repo.putWeight(makeWeight({ id: 'w' }));
    await repo.putProfile({ ...EMPTY_PROFILE, age: 31, updatedAt: '2026-10-10T00:00:00.000Z' });
    await repo.putCustomMeals(['Pre-workout']);
    const { snapshot } = await repo.loadAll();
    expect(snapshot.assessments[0]?.id).toBe('a');
    expect(snapshot.weights[0]?.id).toBe('w');
    expect(snapshot.profile.age).toBe(31);
    expect(snapshot.customMeals).toEqual(['Pre-workout']);
  });

  it('hides corrupted records on load without deleting them', async () => {
    const { name, repo } = await freshRepo();
    await repo.putFoodEntry(makeEntry({ id: 'good' }));
    repo.close();
    const raw = await openDB(name, DB_VERSION);
    await raw.put('foodEntries', { id: 'bad', date: 'yesterday', calories: 'lots' });
    raw.close();
    const again = await createIndexedDbRepository(name);
    repos.push(again);
    const { snapshot, skippedRecords } = await again.loadAll();
    expect(snapshot.foodEntries.map((e) => e.id)).toEqual(['good']);
    expect(skippedRecords).toBe(1);
  });

  it('applies imports atomically: a failing write leaves existing data intact', async () => {
    const { repo } = await freshRepo();
    await repo.putFoodEntry(makeEntry({ id: 'existing' }));
    // An entry with an unclonable value makes the put throw mid-transaction.
    const poisoned = { ...makeEntry({ id: 'poison' }), notes: (() => undefined) as unknown as string };
    await expect(
      repo.applyImport({
        replace: true,
        foodEntries: [makeEntry({ id: 'new1' }), poisoned],
        assessments: [],
        weights: [],
        profile: null,
        targets: null,
        customMeals: null,
      }),
    ).rejects.toBeTruthy();
    const { snapshot } = await repo.loadAll();
    expect(snapshot.foodEntries.map((e) => e.id)).toEqual(['existing']);
  });

  it('clears everything', async () => {
    const { repo } = await freshRepo();
    await repo.putFoodEntry(makeEntry());
    await repo.putWeight(makeWeight());
    await repo.clearAll();
    const { snapshot } = await repo.loadAll();
    expect(snapshot.foodEntries).toHaveLength(0);
    expect(snapshot.weights).toHaveLength(0);
  });
});

describe('memory repository fallback', () => {
  it('supports the same operations', async () => {
    const repo = createMemoryRepository();
    await repo.putFoodEntry(makeEntry({ id: 'm1' }));
    await repo.putFoodEntry(makeEntry({ id: 'm1', calories: 999 }));
    const { snapshot } = await repo.loadAll();
    expect(snapshot.foodEntries).toHaveLength(1);
    expect(snapshot.foodEntries[0]?.calories).toBe(999);
  });

  it('deletes many records', async () => {
    const repo = createMemoryRepository();
    for (const id of ['a', 'b']) await repo.putFoodEntry(makeEntry({ id }));
    await repo.deleteMany('foodEntries', ['a']);
    expect((await repo.loadAll()).snapshot.foodEntries.map((e) => e.id)).toEqual(['b']);
  });
});
