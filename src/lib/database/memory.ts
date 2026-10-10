import type { Assessment, FoodEntry, WeightRecord } from '../../types/models';
import { emptySnapshot } from './snapshot';
import type { DataSnapshot, ImportPlan, Repository } from './types';

/**
 * Session-only repository used when IndexedDB cannot be opened (e.g. some
 * private-browsing modes). The UI clearly warns that nothing will be kept.
 */
export function createMemoryRepository(initial: DataSnapshot = emptySnapshot()): Repository {
  const food = new Map<string, FoodEntry>(initial.foodEntries.map((e) => [e.id, e]));
  const assessments = new Map<string, Assessment>(initial.assessments.map((a) => [a.id, a]));
  const weights = new Map<string, WeightRecord>(initial.weights.map((w) => [w.id, w]));
  let profile = structuredClone(initial.profile);
  let targets = structuredClone(initial.targets);
  let customMeals = [...initial.customMeals];

  return {
    kind: 'memory',
    async loadAll() {
      return {
        snapshot: structuredClone({
          foodEntries: [...food.values()],
          assessments: [...assessments.values()],
          weights: [...weights.values()],
          profile,
          targets,
          customMeals,
        }),
        skippedRecords: 0,
      };
    },
    async putFoodEntry(e) {
      food.set(e.id, structuredClone(e));
    },
    async deleteFoodEntry(id) {
      food.delete(id);
    },
    async putAssessment(a) {
      assessments.set(a.id, structuredClone(a));
    },
    async deleteAssessment(id) {
      assessments.delete(id);
    },
    async putWeight(w) {
      weights.set(w.id, structuredClone(w));
    },
    async deleteWeight(id) {
      weights.delete(id);
    },
    async deleteMany(store, ids) {
      const map = store === 'foodEntries' ? food : store === 'assessments' ? assessments : weights;
      for (const id of ids) map.delete(id);
    },
    async putProfile(p) {
      profile = structuredClone(p);
    },
    async putTargets(t) {
      targets = structuredClone(t);
    },
    async putCustomMeals(m) {
      customMeals = [...m];
    },
    async applyImport(plan: ImportPlan) {
      if (plan.replace) {
        food.clear();
        assessments.clear();
        weights.clear();
        const empty = emptySnapshot();
        profile = empty.profile;
        targets = empty.targets;
        customMeals = [];
      }
      for (const e of plan.foodEntries) food.set(e.id, structuredClone(e));
      for (const a of plan.assessments) assessments.set(a.id, structuredClone(a));
      for (const w of plan.weights) weights.set(w.id, structuredClone(w));
      if (plan.profile) profile = structuredClone(plan.profile);
      if (plan.targets) targets = structuredClone(plan.targets);
      if (plan.customMeals) customMeals = [...plan.customMeals];
    },
    async clearAll() {
      food.clear();
      assessments.clear();
      weights.clear();
      const empty = emptySnapshot();
      profile = empty.profile;
      targets = empty.targets;
      customMeals = [];
    },
    close() {},
  };
}
