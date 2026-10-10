import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Assessment, FoodEntry, WeightRecord } from '../../types/models';
import { sanitizeLoaded } from './snapshot';
import type { ImportPlan, LoadResult, Repository, SettingKey } from './types';

export const DB_NAME = 'nutriledger';
/**
 * Schema version. Upgrades must be additive: never delete an object store or
 * records in `upgrade`; transform records in place if the shape changes.
 */
export const DB_VERSION = 1;

interface SettingRow {
  key: SettingKey;
  value: unknown;
}

interface NutriLedgerDB extends DBSchema {
  foodEntries: { key: string; value: FoodEntry; indexes: { 'by-date': string } };
  assessments: { key: string; value: Assessment; indexes: { 'by-date': string } };
  weights: { key: string; value: WeightRecord; indexes: { 'by-date': string } };
  settings: { key: SettingKey; value: SettingRow };
}

const STORES = ['foodEntries', 'assessments', 'weights', 'settings'] as const;

export class StorageUnavailableError extends Error {
  override name = 'StorageUnavailableError';
}

/** Opens (and if necessary creates or upgrades) the database. */
export async function openNutriDb(
  name: string = DB_NAME,
  timeoutMs = 8000,
): Promise<IDBPDatabase<NutriLedgerDB>> {
  if (typeof indexedDB === 'undefined') {
    throw new StorageUnavailableError('IndexedDB is not available in this browser.');
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new StorageUnavailableError('Opening local storage timed out.')),
      timeoutMs,
    );
  });
  const open = openDB<NutriLedgerDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Version-by-version, additive migrations. Each case falls through so a
      // user several versions behind runs every step in order.
      if (oldVersion < 1) {
        const food = db.createObjectStore('foodEntries', { keyPath: 'id' });
        food.createIndex('by-date', 'date');
        const assessments = db.createObjectStore('assessments', { keyPath: 'id' });
        assessments.createIndex('by-date', 'date');
        const weights = db.createObjectStore('weights', { keyPath: 'id' });
        weights.createIndex('by-date', 'date');
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
    blocked() {
      // Another tab still has an older version open; the open will wait.
      console.warn('NutriLedger: database upgrade waiting for other tabs to close.');
    },
  });
  try {
    const db = await Promise.race([open, timeout]);
    // If a newer version of the app opens the DB in another tab, release ours so
    // its upgrade can proceed; this tab will prompt for reload via the SW update flow.
    db.addEventListener('versionchange', () => db.close());
    return db;
  } catch (err) {
    if (err instanceof StorageUnavailableError) throw err;
    throw new StorageUnavailableError(
      err instanceof Error ? `Local storage could not be opened: ${err.name}` : 'Local storage could not be opened.',
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function createIndexedDbRepository(name: string = DB_NAME): Promise<Repository> {
  const db = await openNutriDb(name);

  const putSetting = async (key: SettingKey, value: unknown) => {
    await db.put('settings', { key, value });
  };

  return {
    kind: 'indexeddb',
    async loadAll(): Promise<LoadResult> {
      const tx = db.transaction(STORES, 'readonly');
      const [foodEntries, assessments, weights, settings] = await Promise.all([
        tx.objectStore('foodEntries').getAll(),
        tx.objectStore('assessments').getAll(),
        tx.objectStore('weights').getAll(),
        tx.objectStore('settings').getAll(),
        tx.done,
      ]);
      const byKey = new Map(settings.map((s) => [s.key, s.value]));
      return sanitizeLoaded({
        foodEntries,
        assessments,
        weights,
        profile: byKey.get('profile'),
        targets: byKey.get('targets'),
        customMeals: byKey.get('customMeals'),
      });
    },
    async putFoodEntry(entry) {
      await db.put('foodEntries', entry);
    },
    async deleteFoodEntry(id) {
      await db.delete('foodEntries', id);
    },
    async putAssessment(a) {
      await db.put('assessments', a);
    },
    async deleteAssessment(id) {
      await db.delete('assessments', id);
    },
    async putWeight(w) {
      await db.put('weights', w);
    },
    async deleteWeight(id) {
      await db.delete('weights', id);
    },
    async deleteMany(store, ids) {
      const tx = db.transaction(store, 'readwrite');
      const done = tx.done;
      done.catch(() => undefined);
      const os = tx.objectStore(store);
      const ops = ids.map((id) => {
        const p = os.delete(id);
        p.catch(() => undefined);
        return p;
      });
      try {
        await Promise.all(ops);
        await done;
      } catch (err) {
        try {
          tx.abort();
        } catch {
          // Already finished.
        }
        throw err;
      }
    },
    putProfile: (p) => putSetting('profile', p),
    putTargets: (t) => putSetting('targets', t),
    putCustomMeals: (m) => putSetting('customMeals', m),
    async applyImport(plan: ImportPlan) {
      // One transaction across all stores: if any write fails the whole
      // transaction aborts and the existing data is left exactly as it was.
      const tx = db.transaction(STORES, 'readwrite');
      const done = tx.done;
      // Mark as handled now; it is awaited below. Without this an abort would
      // surface as an unhandled rejection before we reach the await.
      done.catch(() => undefined);
      const food = tx.objectStore('foodEntries');
      const assessments = tx.objectStore('assessments');
      const weights = tx.objectStore('weights');
      const settings = tx.objectStore('settings');
      const ops: Promise<unknown>[] = [];
      const track = (p: Promise<unknown>) => {
        p.catch(() => undefined);
        ops.push(p);
      };
      try {
        if (plan.replace) {
          track(food.clear());
          track(assessments.clear());
          track(weights.clear());
          track(settings.clear());
        }
        for (const e of plan.foodEntries) track(food.put(e));
        for (const a of plan.assessments) track(assessments.put(a));
        for (const w of plan.weights) track(weights.put(w));
        if (plan.profile) track(settings.put({ key: 'profile', value: plan.profile }));
        if (plan.targets) track(settings.put({ key: 'targets', value: plan.targets }));
        if (plan.customMeals) track(settings.put({ key: 'customMeals', value: plan.customMeals }));
        await Promise.all(ops);
        await done;
      } catch (err) {
        try {
          tx.abort();
        } catch {
          // Transaction already finished/aborted.
        }
        throw err;
      }
    },
    async clearAll() {
      const tx = db.transaction(STORES, 'readwrite');
      await Promise.all([
        tx.objectStore('foodEntries').clear(),
        tx.objectStore('assessments').clear(),
        tx.objectStore('weights').clear(),
        tx.objectStore('settings').clear(),
        tx.done,
      ]);
    },
    close() {
      db.close();
    },
  };
}
