import type { ActivityLevel, Sex } from '../../types/models';
import { fail, isFiniteNumber, ok, type CalcResult } from './result';

/**
 * Activity multipliers applied to BMR to estimate TDEE. These are the commonly
 * used population-level factors (sedentary 1.2 … extra active 1.9). They are
 * documented assumptions, not measurements. They already include typical
 * exercise, so wearable "active calories" must NOT be added on top.
 */
export const ACTIVITY_INFO: Record<
  ActivityLevel,
  { label: string; multiplier: number; description: string }
> = {
  sedentary: {
    label: 'Sedentary',
    multiplier: 1.2,
    description: 'Little or no exercise; mostly sitting during the day.',
  },
  light: {
    label: 'Lightly active',
    multiplier: 1.375,
    description: 'Light exercise or sport 1–3 days a week.',
  },
  moderate: {
    label: 'Moderately active',
    multiplier: 1.55,
    description: 'Moderate exercise or sport 3–5 days a week.',
  },
  very: {
    label: 'Very active',
    multiplier: 1.725,
    description: 'Hard exercise or sport 6–7 days a week.',
  },
  extra: {
    label: 'Extra active',
    multiplier: 1.9,
    description: 'Very hard daily exercise or a physically demanding job.',
  },
};

/** Inputs are validated so the equations are only used for adults with plausible values. */
export const ENERGY_BOUNDS = {
  ageMin: 18,
  ageMax: 120,
  heightCmMin: 100,
  heightCmMax: 250,
  weightKgMin: 30,
  weightKgMax: 350,
} as const;

export interface BmrInputs {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
}

/**
 * Mifflin–St Jeor (1990) resting energy expenditure, kcal/day.
 *   male:   10·kg + 6.25·cm − 5·age + 5
 *   female: 10·kg + 6.25·cm − 5·age − 161
 * A population-level estimate for adults; individual needs vary.
 */
export function mifflinStJeor(input: BmrInputs): CalcResult<number> {
  const { sex, age, heightCm, weightKg } = input;
  if (!isFiniteNumber(age)) return fail('Enter your age as a number.', 'age');
  if (!isFiniteNumber(heightCm)) return fail('Enter your height as a number.', 'height');
  if (!isFiniteNumber(weightKg)) return fail('Enter your weight as a number.', 'weight');
  if (sex !== 'male' && sex !== 'female')
    return fail('Choose the equation variant (male or female).', 'sex');
  if (age < ENERGY_BOUNDS.ageMin)
    return fail(
      'The Mifflin–St Jeor equation is designed for adults (18+). NutriLedger does not estimate energy needs for younger people — please ask a doctor or registered dietitian.',
      'age',
    );
  if (age > ENERGY_BOUNDS.ageMax) return fail('Check your age.', 'age');
  if (heightCm < ENERGY_BOUNDS.heightCmMin || heightCm > ENERGY_BOUNDS.heightCmMax)
    return fail('Height is outside the range the equation supports (100–250 cm).', 'height');
  if (weightKg < ENERGY_BOUNDS.weightKgMin || weightKg > ENERGY_BOUNDS.weightKgMax)
    return fail('Weight is outside the range the equation supports (30–350 kg).', 'weight');

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = sex === 'male' ? base + 5 : base - 161;
  if (!isFiniteNumber(bmr) || bmr <= 0) return fail('These inputs do not produce a valid estimate.');
  return ok(bmr);
}

/**
 * Katch–McArdle: BMR = 370 + 21.6 · lean body mass (kg).
 * Only meaningful when lean mass comes from a valid body-fat estimate.
 */
export function katchMcArdle(leanMassKg: number): CalcResult<number> {
  if (!isFiniteNumber(leanMassKg) || leanMassKg <= 0)
    return fail('Lean body mass must be a positive number.');
  if (leanMassKg < 15 || leanMassKg > 200)
    return fail('Lean body mass is outside a plausible range.');
  return ok(370 + 21.6 * leanMassKg);
}

/** TDEE = BMR × activity multiplier. */
export function tdee(bmr: number, activity: ActivityLevel): CalcResult<number> {
  if (!isFiniteNumber(bmr) || bmr <= 0) return fail('BMR must be a positive number.');
  const info = ACTIVITY_INFO[activity];
  if (!info) return fail('Choose an activity level.', 'activity');
  return ok(bmr * info.multiplier);
}

/**
 * Estimated energy balance = recorded intake − estimated TDEE.
 * Positive: recorded intake above estimated expenditure. Negative: below.
 * This is an estimate; logs may be incomplete and TDEE is not measured.
 */
export function energyBalance(recordedIntake: number, estimatedTdee: number): CalcResult<number> {
  if (!isFiniteNumber(recordedIntake) || recordedIntake < 0)
    return fail('Recorded intake must be zero or more.');
  if (!isFiniteNumber(estimatedTdee) || estimatedTdee <= 0)
    return fail('An estimated TDEE is required.');
  return ok(recordedIntake - estimatedTdee);
}
