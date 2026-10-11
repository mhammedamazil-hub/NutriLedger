import type { FoodEntry, FoodEntryInput, NutritionSource } from '../../types/models';
import { parseNumberInput } from '../../lib/formatting/numbers';
import { foodEntryFieldsSchema, issuesToFieldErrors } from '../../lib/validation/schemas';

/** Raw form strings. Numbers stay as typed so invalid input is preserved while it is corrected. */
export interface FoodFormValues {
  date: string;
  meal: string;
  name: string;
  quantity: string;
  unit: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  notes: string;
  source: NutritionSource;
}

export const emptyFoodForm = (date: string, meal = 'breakfast'): FoodFormValues => ({
  date,
  meal,
  name: '',
  quantity: '',
  unit: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  notes: '',
  source: 'manual',
});

const str = (n: number | null) => (n === null ? '' : String(Math.round(n * 100) / 100));

export const entryToForm = (e: FoodEntry): FoodFormValues => ({
  date: e.date,
  meal: e.meal,
  name: e.name,
  quantity: str(e.quantity),
  unit: e.unit,
  calories: str(e.calories),
  protein: str(e.protein),
  carbs: str(e.carbs),
  fat: str(e.fat),
  fiber: str(e.fiber),
  notes: e.notes,
  source: e.source,
});

export type ParseResult = { ok: true; value: FoodEntryInput } | { ok: false; errors: Record<string, string> };

const NUMERIC = ['quantity', 'calories', 'protein', 'carbs', 'fat', 'fiber'] as const;

export function parseFoodForm(v: FoodFormValues): ParseResult {
  const errors: Record<string, string> = {};
  const nums: Record<(typeof NUMERIC)[number], number | null> = {
    quantity: null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    fiber: null,
  };
  for (const key of NUMERIC) {
    const n = parseNumberInput(v[key]);
    if (n !== null && Number.isNaN(n)) errors[key] = 'Enter a number, e.g. 12.5';
    else nums[key] = n;
  }
  if (!errors.calories && nums.calories === null) errors.calories = 'Enter the calories for this portion.';

  const candidate = {
    date: v.date,
    meal: v.meal,
    name: v.name,
    quantity: nums.quantity,
    unit: v.unit,
    calories: nums.calories ?? Number.NaN,
    protein: nums.protein,
    carbs: nums.carbs,
    fat: nums.fat,
    fiber: nums.fiber,
    notes: v.notes,
    source: v.source,
  };
  const parsed = foodEntryFieldsSchema.safeParse(candidate);
  if (!parsed.success) {
    const zErrors = issuesToFieldErrors(parsed.error);
    for (const [k, msg] of Object.entries(zErrors)) if (!errors[k]) errors[k] = msg;
  }
  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, value: parsed.data };
}
