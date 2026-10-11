import type {
  Assessment,
  AssessmentInputs,
  AssessmentResults,
  FoodEntry,
  FoodEntryInput,
  Profile,
  Targets,
  WeightRecord,
} from '../types/models';
import { createMemoryRepository } from '../lib/database/memory';
import { emptySnapshot } from '../lib/database/snapshot';
import type { DataSnapshot, ImportPlan, Repository } from '../lib/database/types';
import { createId } from '../lib/ids';
import { nowIso } from '../lib/formatting/dates';
import {
  assessmentSchema,
  customMealsSchema,
  foodEntrySchema,
  profileSchema,
  targetsSchema,
  weightRecordSchema,
} from '../lib/validation/schemas';

export type StoreStatus = 'loading' | 'ready' | 'memory';

export interface DataState extends DataSnapshot {
  status: StoreStatus;
  /** Records hidden because they failed validation on load. */
  skippedRecords: number;
  /** Explanation shown when durable storage is unavailable. */
  storageMessage: string | null;
}

type Listener = () => void;

const CHANNEL = 'nutriledger-data';

/**
 * Single source of truth for personal records in the UI. Every mutation is
 * validated, written to the repository first, and only then reflected in
 * state, so the UI never shows a record that failed to persist. Writes are
 * serialised through a queue to avoid races between rapid interactions.
 */
export class DataStore {
  private state: DataState = { ...emptySnapshot(), status: 'loading', skippedRecords: 0, storageMessage: null };
  private listeners = new Set<Listener>();
  private repo: Repository | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private channel: BroadcastChannel | null = null;
  private initPromise: Promise<void> | null = null;

  private readonly openRepository: () => Promise<Repository>;

  constructor(openRepository: () => Promise<Repository>) {
    this.openRepository = openRepository;
  }

  getState = (): DataState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(patch: Partial<DataState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  init(): Promise<void> {
    this.initPromise ??= this.doInit();
    return this.initPromise;
  }

  private async doInit() {
    try {
      this.repo = await this.openRepository();
      const { snapshot, skippedRecords } = await this.repo.loadAll();
      this.setState({ ...snapshot, status: 'ready', skippedRecords, storageMessage: null });
    } catch (err) {
      console.warn('NutriLedger: durable storage unavailable, using session memory.', err instanceof Error ? err.name : '');
      this.repo = createMemoryRepository();
      this.setState({
        ...emptySnapshot(),
        status: 'memory',
        skippedRecords: 0,
        storageMessage:
          'This browser did not allow NutriLedger to open its local database (private browsing or blocked storage can cause this). You can keep using the app, but records will be lost when this tab closes. Export a backup before leaving.',
      });
    }
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = () => {
        void this.reload();
      };
    }
  }

  /** Re-reads everything from storage (used after imports and when another tab changes data). */
  async reload(): Promise<void> {
    if (!this.repo) return;
    const { snapshot, skippedRecords } = await this.repo.loadAll();
    this.setState({ ...snapshot, skippedRecords });
  }

  private run<T>(task: (repo: Repository) => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      if (!this.repo) await this.init();
      if (!this.repo) throw new Error('Storage is not ready.');
      const result = await task(this.repo);
      this.channel?.postMessage('changed');
      return result;
    });
    // Keep the queue alive after a failure; the caller still receives the rejection.
    this.queue = next.catch(() => undefined);
    return next;
  }

  snapshot(): DataSnapshot {
    const { foodEntries, assessments, weights, profile, targets, customMeals } = this.state;
    return { foodEntries, assessments, weights, profile, targets, customMeals };
  }

  // ---- Food entries ---------------------------------------------------------

  addFoodEntry(input: FoodEntryInput): Promise<FoodEntry> {
    return this.run(async (repo) => {
      const ts = nowIso();
      const entry = foodEntrySchema.parse({ ...input, id: createId(), createdAt: ts, updatedAt: ts });
      await repo.putFoodEntry(entry);
      this.setState({ foodEntries: [...this.state.foodEntries, entry] });
      return entry;
    });
  }

  updateFoodEntry(id: string, input: FoodEntryInput): Promise<FoodEntry> {
    return this.run(async (repo) => {
      const prev = this.state.foodEntries.find((e) => e.id === id);
      if (!prev) throw new Error('That entry no longer exists.');
      const entry = foodEntrySchema.parse({ ...prev, ...input, id, updatedAt: nowIso() });
      await repo.putFoodEntry(entry);
      this.setState({ foodEntries: this.state.foodEntries.map((e) => (e.id === id ? entry : e)) });
      return entry;
    });
  }

  deleteFoodEntry(id: string): Promise<FoodEntry | undefined> {
    return this.run(async (repo) => {
      const prev = this.state.foodEntries.find((e) => e.id === id);
      await repo.deleteFoodEntry(id);
      this.setState({ foodEntries: this.state.foodEntries.filter((e) => e.id !== id) });
      return prev;
    });
  }

  /** Deletes several entries atomically (used by "delete all entries for this day"). */
  deleteFoodEntries(ids: readonly string[]): Promise<number> {
    return this.run(async (repo) => {
      const set = new Set(ids);
      await repo.deleteMany('foodEntries', [...set]);
      const before = this.state.foodEntries.length;
      this.setState({ foodEntries: this.state.foodEntries.filter((e) => !set.has(e.id)) });
      return before - this.state.foodEntries.length;
    });
  }

  /** Re-inserts a previously deleted entry with its original ID (undo). */
  restoreFoodEntry(entry: FoodEntry): Promise<void> {
    return this.run(async (repo) => {
      const valid = foodEntrySchema.parse(entry);
      await repo.putFoodEntry(valid);
      if (!this.state.foodEntries.some((e) => e.id === valid.id)) {
        this.setState({ foodEntries: [...this.state.foodEntries, valid] });
      }
    });
  }

  // ---- Assessments ----------------------------------------------------------

  saveAssessment(input: {
    date: string;
    inputs: AssessmentInputs;
    results: AssessmentResults;
    notes: string;
  }): Promise<Assessment> {
    return this.run(async (repo) => {
      // Always a new record: saving never overwrites history.
      const a = assessmentSchema.parse({ ...input, id: createId(), createdAt: nowIso() });
      await repo.putAssessment(a);
      this.setState({ assessments: [...this.state.assessments, a] });
      return a;
    });
  }

  deleteAssessment(id: string): Promise<void> {
    return this.run(async (repo) => {
      await repo.deleteAssessment(id);
      this.setState({ assessments: this.state.assessments.filter((a) => a.id !== id) });
    });
  }

  // ---- Weights --------------------------------------------------------------

  addWeight(input: { date: string; weightKg: number; note: string }): Promise<WeightRecord> {
    return this.run(async (repo) => {
      const ts = nowIso();
      const w = weightRecordSchema.parse({ ...input, id: createId(), createdAt: ts, updatedAt: ts });
      await repo.putWeight(w);
      this.setState({ weights: [...this.state.weights, w] });
      return w;
    });
  }

  updateWeight(id: string, input: { date: string; weightKg: number; note: string }): Promise<WeightRecord> {
    return this.run(async (repo) => {
      const prev = this.state.weights.find((w) => w.id === id);
      if (!prev) throw new Error('That record no longer exists.');
      const w = weightRecordSchema.parse({ ...prev, ...input, updatedAt: nowIso() });
      await repo.putWeight(w);
      this.setState({ weights: this.state.weights.map((x) => (x.id === id ? w : x)) });
      return w;
    });
  }

  deleteWeight(id: string): Promise<WeightRecord | undefined> {
    return this.run(async (repo) => {
      const prev = this.state.weights.find((w) => w.id === id);
      await repo.deleteWeight(id);
      this.setState({ weights: this.state.weights.filter((w) => w.id !== id) });
      return prev;
    });
  }

  restoreWeight(w: WeightRecord): Promise<void> {
    return this.run(async (repo) => {
      const valid = weightRecordSchema.parse(w);
      await repo.putWeight(valid);
      if (!this.state.weights.some((x) => x.id === valid.id)) {
        this.setState({ weights: [...this.state.weights, valid] });
      }
    });
  }

  /** Deletes every weight record atomically. */
  clearWeights(): Promise<void> {
    return this.run(async (repo) => {
      await repo.deleteMany('weights', this.state.weights.map((w) => w.id));
      this.setState({ weights: [] });
    });
  }

  // ---- Settings records -----------------------------------------------------

  saveProfile(profile: Omit<Profile, 'updatedAt'>): Promise<Profile> {
    return this.run(async (repo) => {
      const p = profileSchema.parse({ ...profile, updatedAt: nowIso() });
      await repo.putProfile(p);
      this.setState({ profile: p });
      return p;
    });
  }

  saveTargets(targets: Omit<Targets, 'updatedAt'>): Promise<Targets> {
    return this.run(async (repo) => {
      const t = targetsSchema.parse({ ...targets, updatedAt: nowIso() });
      await repo.putTargets(t);
      this.setState({ targets: t });
      return t;
    });
  }

  saveCustomMeals(meals: string[]): Promise<void> {
    return this.run(async (repo) => {
      const m = customMealsSchema.parse(meals);
      await repo.putCustomMeals(m);
      this.setState({ customMeals: m });
    });
  }

  // ---- Bulk -----------------------------------------------------------------

  applyImport(plan: ImportPlan): Promise<void> {
    return this.run(async (repo) => {
      await repo.applyImport(plan);
      const { snapshot, skippedRecords } = await repo.loadAll();
      this.setState({ ...snapshot, skippedRecords });
    });
  }

  clearAll(): Promise<void> {
    return this.run(async (repo) => {
      await repo.clearAll();
      this.setState({ ...emptySnapshot(), skippedRecords: 0 });
    });
  }

  dispose() {
    this.channel?.close();
    this.repo?.close();
  }
}
