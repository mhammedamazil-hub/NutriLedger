import type { AssessmentInputs, AssessmentResults, Profile } from '../../types/models';
import { navyBodyFat, leanBodyMass } from './bodyFat';
import { ACTIVITY_INFO, katchMcArdle, mifflinStJeor, tdee } from './energy';
import { fail, ok, type CalcResult } from './result';

export interface FullEstimate {
  results: AssessmentResults;
  /** Why the optional body-fat estimate could not be produced, if measurements were partly entered. */
  bodyFatIssue: string | null;
}

/** Converts a stored profile into calculator inputs, reporting the first missing field. */
export function profileToInputs(profile: Profile): CalcResult<AssessmentInputs> {
  if (profile.age === null) return fail('Add your age in the Calculator.', 'age');
  if (profile.sex === null) return fail('Choose an equation variant in the Calculator.', 'sex');
  if (profile.heightCm === null) return fail('Add your height in the Calculator.', 'height');
  if (profile.weightKg === null) return fail('Add your weight in the Calculator.', 'weight');
  if (profile.activity === null) return fail('Choose an activity level in the Calculator.', 'activity');
  return ok({
    age: profile.age,
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activity: profile.activity,
    neckCm: profile.neckCm,
    waistCm: profile.waistCm,
    hipCm: profile.hipCm,
  });
}

/**
 * Runs every supported estimate for a set of inputs. Mifflin–St Jeor is the
 * default; Katch–McArdle is added only when a valid Navy body-fat estimate exists.
 */
export function computeEstimate(inputs: AssessmentInputs): CalcResult<FullEstimate> {
  const bmr = mifflinStJeor(inputs);
  if (!bmr.ok) return bmr;
  const total = tdee(bmr.value, inputs.activity);
  if (!total.ok) return total;

  let bodyFatPercent: number | null = null;
  let leanMassKg: number | null = null;
  let katchBmr: number | null = null;
  let katchTdee: number | null = null;
  let bodyFatIssue: string | null = null;

  const anyMeasurement =
    inputs.neckCm !== null || inputs.waistCm !== null || inputs.hipCm !== null;
  if (anyMeasurement) {
    const bf = navyBodyFat(inputs);
    if (bf.ok) {
      bodyFatPercent = bf.value;
      const lbm = leanBodyMass(inputs.weightKg, bf.value);
      if (lbm.ok) {
        leanMassKg = lbm.value;
        const k = katchMcArdle(lbm.value);
        if (k.ok) {
          katchBmr = k.value;
          const kt = tdee(k.value, inputs.activity);
          if (kt.ok) katchTdee = kt.value;
        }
      }
    } else {
      bodyFatIssue = bf.reason;
    }
  }

  return ok({
    results: {
      equation: 'mifflin-st-jeor',
      bmr: bmr.value,
      activityMultiplier: ACTIVITY_INFO[inputs.activity].multiplier,
      tdee: total.value,
      bodyFatPercent,
      leanMassKg,
      katchMcArdleBmr: katchBmr,
      katchMcArdleTdee: katchTdee,
    },
    bodyFatIssue,
  });
}
