import type { Sex } from '../../types/models';
import { fail, isFiniteNumber, ok, type CalcResult } from './result';

/**
 * U.S. Navy circumference method (Hodgdon & Beckett, 1984, Naval Health
 * Research Center reports 84-11 and 84-29), metric form with base-10 logs and
 * all lengths in centimetres:
 *
 *   male:   %BF = 495 / (1.0324  − 0.19077·log10(waist − neck)       + 0.15456·log10(height)) − 450
 *   female: %BF = 495 / (1.29579 − 0.35004·log10(waist + hip − neck) + 0.22100·log10(height)) − 450
 *
 * Measurements: neck below the larynx; waist at the navel (men) or at the
 * narrowest point (women); hip at the widest point of the buttocks (women).
 * Chest circumference is never a substitute for hip circumference.
 * Result is a rough field estimate, not a diagnostic measurement.
 */
export interface NavyInputs {
  sex: Sex;
  heightCm: number;
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
}

/** Plausible output window. Results outside it almost always mean a measurement error. */
export const BODY_FAT_PLAUSIBLE = { min: 2, max: 65 } as const;

export const CIRCUMFERENCE_BOUNDS = {
  neck: { min: 20, max: 80 },
  waist: { min: 40, max: 250 },
  hip: { min: 50, max: 250 },
} as const;

function checkCircumference(
  value: number | null,
  name: 'neck' | 'waist' | 'hip',
): CalcResult<number> {
  const label = name === 'hip' ? 'Hip' : name === 'neck' ? 'Neck' : 'Waist';
  if (value === null || value === undefined)
    return fail(`${label} circumference is required for this estimate.`, name);
  if (!isFiniteNumber(value)) return fail(`${label} circumference must be a number.`, name);
  if (value <= 0) return fail(`${label} circumference must be greater than zero.`, name);
  const b = CIRCUMFERENCE_BOUNDS[name];
  if (value < b.min || value > b.max)
    return fail(`${label} circumference should be between ${b.min} and ${b.max} cm.`, name);
  return ok(value);
}

export function navyBodyFat(input: NavyInputs): CalcResult<number> {
  const { sex, heightCm } = input;
  if (sex !== 'male' && sex !== 'female')
    return fail('Choose the equation variant (male or female).', 'sex');
  if (!isFiniteNumber(heightCm) || heightCm <= 0)
    return fail('A valid height is required.', 'height');

  const neck = checkCircumference(input.neckCm, 'neck');
  if (!neck.ok) return neck;
  const waist = checkCircumference(input.waistCm, 'waist');
  if (!waist.ok) return waist;

  let logArgument: number;
  if (sex === 'male') {
    logArgument = waist.value - neck.value;
  } else {
    const hip = checkCircumference(input.hipCm, 'hip');
    if (!hip.ok) return hip;
    logArgument = waist.value + hip.value - neck.value;
  }

  // log10 is only defined for positive arguments.
  if (!(logArgument > 0))
    return fail(
      sex === 'male'
        ? 'Waist must be larger than neck circumference for this equation.'
        : 'Waist plus hip must be larger than neck circumference for this equation.',
      'waist',
    );

  const denominator =
    sex === 'male'
      ? 1.0324 - 0.19077 * Math.log10(logArgument) + 0.15456 * Math.log10(heightCm)
      : 1.29579 - 0.35004 * Math.log10(logArgument) + 0.221 * Math.log10(heightCm);

  if (!isFiniteNumber(denominator) || denominator <= 0)
    return fail('These measurements cannot be used with the equation. Please re-check them.');

  const percent = 495 / denominator - 450;
  if (!isFiniteNumber(percent))
    return fail('These measurements cannot be used with the equation. Please re-check them.');
  if (percent < BODY_FAT_PLAUSIBLE.min || percent > BODY_FAT_PLAUSIBLE.max)
    return fail(
      'The estimate falls outside a plausible range, which usually means a measurement was entered incorrectly.',
      'waist',
    );
  return ok(percent);
}

/** Lean body mass from weight and a valid body-fat percentage. */
export function leanBodyMass(weightKg: number, bodyFatPercent: number): CalcResult<number> {
  if (!isFiniteNumber(weightKg) || weightKg <= 0) return fail('A valid weight is required.');
  if (
    !isFiniteNumber(bodyFatPercent) ||
    bodyFatPercent < BODY_FAT_PLAUSIBLE.min ||
    bodyFatPercent > BODY_FAT_PLAUSIBLE.max
  )
    return fail('A valid body-fat estimate is required.');
  return ok(weightKg * (1 - bodyFatPercent / 100));
}
