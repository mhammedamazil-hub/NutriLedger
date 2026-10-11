/**
 * Validation bounds. They exist to catch typos and unit mix-ups (e.g. a weight
 * typed in grams), not to judge normal bodies, so they are deliberately wide.
 * Calculator equations apply their own, narrower adult ranges (see
 * lib/calculations/energy.ts) and explain when an estimate is not appropriate.
 */
export const BOUNDS = {
  age: { min: 1, max: 120 },
  heightCm: { min: 50, max: 272 },
  weightKg: { min: 20, max: 500 },
  neckCm: { min: 20, max: 80 },
  waistCm: { min: 40, max: 250 },
  hipCm: { min: 50, max: 250 },
  /** Per food entry: a single recorded portion. */
  calories: { min: 0, max: 10000 },
  macroG: { min: 0, max: 1000 },
  fiberG: { min: 0, max: 300 },
  quantity: { min: 0, max: 100000 },
  /** Daily targets. */
  targetCalories: { min: 500, max: 10000 },
  targetMacroG: { min: 0, max: 1000 },
  text: { name: 120, unit: 24, notes: 1000, meal: 40 },
  customMeals: 12,
} as const;

/** Below this, a daily calorie target warrants a gentle caution (not a block). */
export const LOW_TARGET_CAUTION_KCAL = 1200;
