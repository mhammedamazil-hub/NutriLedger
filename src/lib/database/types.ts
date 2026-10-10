import type { Assessment, FoodEntry, Profile, Targets, WeightRecord } from '../../types/models';

export interface DataSnapshot {
  foodEntries: FoodEntry[];
  assessments: Assessment[];
  weights: WeightRecord[];
  profile: Profile;
  targets: Targets;
  customMeals: string[];
}

export interface LoadResult {
  snapshot: DataSnapshot;
  /** Number of stored records that failed validation and were left untouched but hidden. */
  skippedRecords: number;
}

export interface ImportPlan {
  /** When true, every store is cleared before writing (inside the same transaction). */
  replace: boolean;
  foodEntries: FoodEntry[];
  assessments: Assessment[];
  weights: WeightRecord[];
  profile: Profile | null;
  targets: Targets | null;
  customMeals: string[] | null;
}

export type RecordStore = 'foodEntries' | 'assessments' | 'weights';

export type SettingKey = 'profile' | 'targets' | 'customMeals';

/** Persistence boundary. Implemented by IndexedDB and by an in-memory fallback. */
export interface Repository {
  readonly kind: 'indexeddb' | 'memory';
  loadAll(): Promise<LoadResult>;
  putFoodEntry(entry: FoodEntry): Promise<void>;
  deleteFoodEntry(id: string): Promise<void>;
  putAssessment(a: Assessment): Promise<void>;
  deleteAssessment(id: string): Promise<void>;
  putWeight(w: WeightRecord): Promise<void>;
  deleteWeight(id: string): Promise<void>;
  /** Deletes several records from one store in a single atomic transaction. */
  deleteMany(store: RecordStore, ids: readonly string[]): Promise<void>;
  putProfile(p: Profile): Promise<void>;
  putTargets(t: Targets): Promise<void>;
  putCustomMeals(m: string[]): Promise<void>;
  /** Applies an import atomically: either every write lands or none do. */
  applyImport(plan: ImportPlan): Promise<void>;
  clearAll(): Promise<void>;
  close(): void;
}
