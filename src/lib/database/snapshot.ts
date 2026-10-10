import { EMPTY_PROFILE, EMPTY_TARGETS, type Assessment, type FoodEntry, type WeightRecord } from '../../types/models';
import {
  assessmentSchema,
  customMealsSchema,
  foodEntrySchema,
  profileSchema,
  targetsSchema,
  weightRecordSchema,
} from '../validation/schemas';
import type { DataSnapshot, LoadResult } from './types';

export const emptySnapshot = (): DataSnapshot => ({
  foodEntries: [],
  assessments: [],
  weights: [],
  profile: { ...EMPTY_PROFILE },
  targets: { ...EMPTY_TARGETS },
  customMeals: [],
});

/**
 * Validates raw stored values. Records that fail validation (e.g. edited by
 * hand in devtools, or written by a buggy older build) are hidden and counted
 * rather than deleted, so nothing is destroyed silently.
 */
export function sanitizeLoaded(raw: {
  foodEntries: unknown[];
  assessments: unknown[];
  weights: unknown[];
  profile: unknown;
  targets: unknown;
  customMeals: unknown;
}): LoadResult {
  let skipped = 0;
  const keep = <T>(items: unknown[], schema: { safeParse(v: unknown): { success: boolean; data?: T } }): T[] => {
    const out: T[] = [];
    for (const item of items) {
      const r = schema.safeParse(item);
      if (r.success && r.data !== undefined) out.push(r.data);
      else skipped += 1;
    }
    return out;
  };

  const foodEntries = keep<FoodEntry>(raw.foodEntries, foodEntrySchema);
  const assessments = keep<Assessment>(raw.assessments, assessmentSchema);
  const weights = keep<WeightRecord>(raw.weights, weightRecordSchema);

  const empty = emptySnapshot();
  let profile = empty.profile;
  if (raw.profile !== undefined) {
    const r = profileSchema.safeParse(raw.profile);
    if (r.success) profile = r.data;
    else skipped += 1;
  }
  let targets = empty.targets;
  if (raw.targets !== undefined) {
    const r = targetsSchema.safeParse(raw.targets);
    if (r.success) targets = r.data;
    else skipped += 1;
  }
  let customMeals: string[] = [];
  if (raw.customMeals !== undefined) {
    const r = customMealsSchema.safeParse(raw.customMeals);
    if (r.success) customMeals = r.data;
    else skipped += 1;
  }

  return {
    snapshot: { foodEntries, assessments, weights, profile, targets, customMeals },
    skippedRecords: skipped,
  };
}
