import type { FoodEntry } from '../../types/models';
import { fail, isFiniteNumber, ok, type CalcResult } from './result';

export type MacroKey = 'protein' | 'carbs' | 'fat' | 'fiber';
export const MACRO_KEYS: readonly MacroKey[] = ['protein', 'carbs', 'fat', 'fiber'];

export interface ReferenceNutrition {
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
}

/**
 * Serving scaling, used when the user knows nutrition for a reference serving
 * (e.g. a label "per 100 g") and ate a different amount *in the same unit*:
 *
 *   scaled = reference nutrition × eaten quantity ÷ reference quantity
 *
 * Both quantities must share one unit; NutriLedger never converts between
 * grams, millilitres, cups or pieces because there is no reliable universal basis.
 */
export function scaleNutrition(
  reference: ReferenceNutrition,
  referenceQuantity: number,
  eatenQuantity: number,
): CalcResult<ReferenceNutrition> {
  if (!isFiniteNumber(referenceQuantity) || referenceQuantity <= 0)
    return fail('Reference serving size must be greater than zero.', 'referenceQuantity');
  if (!isFiniteNumber(eatenQuantity) || eatenQuantity <= 0)
    return fail('Amount eaten must be greater than zero.', 'quantity');
  if (!isFiniteNumber(reference.calories) || reference.calories < 0)
    return fail('Reference calories must be zero or more.', 'calories');
  const factor = eatenQuantity / referenceQuantity;
  const scale = (v: number | null): number | null =>
    v === null ? null : isFiniteNumber(v) && v >= 0 ? v * factor : null;
  return ok({
    calories: reference.calories * factor,
    protein: scale(reference.protein),
    carbs: scale(reference.carbs),
    fat: scale(reference.fat),
    fiber: scale(reference.fiber),
  });
}

export interface MacroTotal {
  /** Sum of recorded values only. */
  total: number;
  /** How many entries recorded this macro. */
  recordedCount: number;
  /** True when every entry in the set recorded this macro (and there was at least one entry). */
  complete: boolean;
}

export interface NutritionTotals {
  entryCount: number;
  calories: number;
  protein: MacroTotal;
  carbs: MacroTotal;
  fat: MacroTotal;
  fiber: MacroTotal;
}

/** Sums one macro without treating unrecorded (null) values as zero. */
export function sumMacro(entries: readonly FoodEntry[], key: MacroKey): MacroTotal {
  let total = 0;
  let recordedCount = 0;
  for (const e of entries) {
    const v = e[key];
    if (isFiniteNumber(v)) {
      total += v;
      recordedCount += 1;
    }
  }
  return { total, recordedCount, complete: entries.length > 0 && recordedCount === entries.length };
}

export function sumCalories(entries: readonly FoodEntry[]): number {
  let total = 0;
  for (const e of entries) if (isFiniteNumber(e.calories)) total += e.calories;
  return total;
}

export function totalsFor(entries: readonly FoodEntry[]): NutritionTotals {
  return {
    entryCount: entries.length,
    calories: sumCalories(entries),
    protein: sumMacro(entries, 'protein'),
    carbs: sumMacro(entries, 'carbs'),
    fat: sumMacro(entries, 'fat'),
    fiber: sumMacro(entries, 'fiber'),
  };
}

/** Groups entries by local day key. */
export function groupByDate(entries: readonly FoodEntry[]): Map<string, FoodEntry[]> {
  const map = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

export function groupByMeal(entries: readonly FoodEntry[]): Map<string, FoodEntry[]> {
  const map = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    const list = map.get(e.meal);
    if (list) list.push(e);
    else map.set(e.meal, [e]);
  }
  return map;
}

export interface DailyPoint {
  date: string;
  /** null = no entries logged that day (missing data, not a verified zero). */
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  entryCount: number;
  /** True if any entry lacked a value for one of protein/carbs/fat. */
  macrosIncomplete: boolean;
}

/** One point per day key in `days`, derived from the same entries as every other view. */
export function dailySeries(entries: readonly FoodEntry[], days: readonly string[]): DailyPoint[] {
  const byDate = groupByDate(entries);
  return days.map((date) => {
    const list = byDate.get(date);
    if (!list || list.length === 0) {
      return {
        date,
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        entryCount: 0,
        macrosIncomplete: false,
      };
    }
    const t = totalsFor(list);
    return {
      date,
      calories: t.calories,
      protein: t.protein.recordedCount ? t.protein.total : null,
      carbs: t.carbs.recordedCount ? t.carbs.total : null,
      fat: t.fat.recordedCount ? t.fat.total : null,
      entryCount: list.length,
      macrosIncomplete: !(t.protein.complete && t.carbs.complete && t.fat.complete),
    };
  });
}

/** Average calories across logged days only; unlogged days are excluded, not counted as zero. */
export function averageLoggedCalories(points: readonly DailyPoint[]): number | null {
  const logged = points.filter((p) => p.calories !== null);
  if (logged.length === 0) return null;
  return logged.reduce((s, p) => s + (p.calories ?? 0), 0) / logged.length;
}
