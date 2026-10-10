import { DEFAULT_MEALS } from '../types/models';

export const DEFAULT_MEAL_LABELS: Record<(typeof DEFAULT_MEALS)[number], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
  other: 'Other',
};

/** Display label for a stored meal value (default key or custom label). */
export function mealLabel(meal: string): string {
  return (DEFAULT_MEAL_LABELS as Record<string, string>)[meal] ?? meal;
}

/** Ordered list of meals: defaults first, then custom meals, then any unknown meals found in data. */
export function orderedMeals(customMeals: readonly string[], extra: Iterable<string> = []): string[] {
  const out: string[] = [...DEFAULT_MEALS];
  const seen = new Set(out);
  for (const m of [...customMeals, ...extra]) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

/** True if `label` would duplicate a default or existing custom meal (case-insensitive). */
export function isDuplicateMeal(label: string, customMeals: readonly string[]): boolean {
  const l = label.trim().toLowerCase();
  return (
    DEFAULT_MEALS.some((m) => m === l || DEFAULT_MEAL_LABELS[m].toLowerCase() === l) ||
    customMeals.some((m) => m.toLowerCase() === l)
  );
}
