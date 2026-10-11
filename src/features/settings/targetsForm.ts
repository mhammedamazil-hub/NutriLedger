import { BOUNDS } from '../../lib/validation/bounds';
import { formatInt, parseNumberInput } from '../../lib/formatting/numbers';

export type TargetKey = 'calories' | 'protein' | 'carbs' | 'fat';
type Key = TargetKey;

export function parseTargets(values: Record<Key, string>):
  | { ok: true; value: Record<Key, number | null> }
  | { ok: false; errors: Partial<Record<Key, string>> } {
  const errors: Partial<Record<Key, string>> = {};
  const out: Record<Key, number | null> = { calories: null, protein: null, carbs: null, fat: null };
  for (const k of ['calories', 'protein', 'carbs', 'fat'] as const) {
    const n = parseNumberInput(values[k]);
    if (n === null) continue;
    if (Number.isNaN(n)) {
      errors[k] = 'Enter a number.';
      continue;
    }
    const b = k === 'calories' ? BOUNDS.targetCalories : BOUNDS.targetMacroG;
    if (n < b.min || n > b.max) {
      errors[k] = k === 'calories' ? `Enter between ${b.min} and ${formatInt(b.max)} kcal, or leave empty.` : `Enter between ${b.min} and ${b.max} g, or leave empty.`;
      continue;
    }
    out[k] = Math.round(n);
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: out };
}

