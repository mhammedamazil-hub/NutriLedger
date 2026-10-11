import { BOUNDS } from '../../lib/validation/bounds';
import { isValidDayKey } from '../../lib/formatting/dates';
import { parseNumberInput, roundTo } from '../../lib/formatting/numbers';
import { kgToLb, lbToKg } from '../../lib/calculations/units';
import type { UnitSystem } from '../../types/models';

export interface WeightFormValues {
  date: string;
  weight: string;
  note: string;
}

export type WeightParse =
  | { ok: true; value: { date: string; weightKg: number; note: string } }
  | { ok: false; errors: Partial<Record<keyof WeightFormValues, string>> };

export function parseWeightForm(v: WeightFormValues, units: UnitSystem, today: string): WeightParse {
  const errors: Partial<Record<keyof WeightFormValues, string>> = {};
  if (!isValidDayKey(v.date)) errors.date = 'Choose a valid date.';
  else if (v.date > today) errors.date = 'Weight records can’t be in the future.';
  const n = parseNumberInput(v.weight);
  let kg: number | null = null;
  if (n === null) errors.weight = 'Enter a weight.';
  else if (Number.isNaN(n)) errors.weight = 'Enter a number.';
  else {
    kg = units === 'imperial' ? lbToKg(n) : n;
    if (kg < BOUNDS.weightKg.min || kg > BOUNDS.weightKg.max) {
      errors.weight =
        units === 'imperial'
          ? `Enter a weight between ${Math.round(kgToLb(BOUNDS.weightKg.min))} and ${Math.round(kgToLb(BOUNDS.weightKg.max))} lb.`
          : `Enter a weight between ${BOUNDS.weightKg.min} and ${BOUNDS.weightKg.max} kg.`;
    }
  }
  if (v.note.length > BOUNDS.text.notes) errors.note = `Keep notes under ${BOUNDS.text.notes} characters.`;
  if (Object.keys(errors).length > 0 || kg === null) return { ok: false, errors };
  return { ok: true, value: { date: v.date, weightKg: roundTo(kg, 3), note: v.note.trim() } };
}

export const weightToDisplay = (kg: number, units: UnitSystem) => String(roundTo(units === 'imperial' ? kgToLb(kg) : kg, 1));
