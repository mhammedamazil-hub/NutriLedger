import type { ActivityLevel, Profile, Sex, UnitSystem } from '../../types/models';
import { ACTIVITY_LEVELS } from '../../types/models';
import { BOUNDS } from '../../lib/validation/bounds';
import { parseNumberInput, roundTo } from '../../lib/formatting/numbers';
import { isValidDayKey } from '../../lib/formatting/dates';
import { cmToFeetInches, cmToIn, feetInchesToCm, inToCm, kgToLb, lbToKg } from '../../lib/calculations/units';

/** Raw strings as typed. Height uses `heightCm` in metric or `heightFt` + `heightIn` in imperial. */
export interface CalcFormValues {
  age: string;
  sex: Sex | '';
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string;
  activity: ActivityLevel | '';
  neck: string;
  waist: string;
  hip: string;
}

type Measured = Omit<Profile, 'updatedAt'>;

const s = (n: number | null, decimals = 1) => (n === null ? '' : String(roundTo(n, decimals)));

export function profileToForm(p: Profile, units: UnitSystem): CalcFormValues {
  const ft = p.heightCm !== null ? cmToFeetInches(p.heightCm) : null;
  const len = (cm: number | null) => (cm === null ? '' : units === 'imperial' ? s(cmToIn(cm)) : s(cm));
  return {
    age: s(p.age, 0),
    sex: p.sex ?? '',
    heightCm: s(p.heightCm),
    heightFt: ft ? String(ft.feet) : '',
    heightIn: ft ? s(ft.inches) : '',
    weight: p.weightKg === null ? '' : units === 'imperial' ? s(kgToLb(p.weightKg)) : s(p.weightKg),
    activity: p.activity ?? '',
    neck: len(p.neckCm),
    waist: len(p.waistCm),
    hip: len(p.hipCm),
  };
}

export type CalcParseResult = { ok: true; profile: Measured } | { ok: false; errors: Partial<Record<keyof CalcFormValues | 'height', string>> };

const fmtBound = (n: number) => String(Math.round(n));

/**
 * Validates calculator input and converts it to metric for storage. Bounds are
 * wide sanity limits (catching typos and unit mix-ups); the equations apply
 * their own adult ranges and explain when an estimate is not possible.
 */
export function parseCalcForm(v: CalcFormValues, units: UnitSystem): CalcParseResult {
  const errors: Partial<Record<keyof CalcFormValues | 'height', string>> = {};
  const imperial = units === 'imperial';

  const read = (raw: string, field: keyof CalcFormValues, required: string | null): number | null => {
    const n = parseNumberInput(raw);
    if (n === null) {
      if (required) errors[field] = required;
      return null;
    }
    if (Number.isNaN(n)) {
      errors[field] = 'Enter a number.';
      return null;
    }
    return n;
  };

  // Age
  const age = read(v.age, 'age', 'Enter your age in years.');
  if (age !== null && (!Number.isInteger(age) || age < BOUNDS.age.min || age > BOUNDS.age.max))
    errors.age = `Enter a whole number of years between ${BOUNDS.age.min} and ${BOUNDS.age.max}.`;

  // Sex (equation variant)
  if (v.sex !== 'male' && v.sex !== 'female') errors.sex = 'Choose which equation variant to use.';

  // Height
  let heightCm: number | null = null;
  if (imperial) {
    const ft = read(v.heightFt, 'heightFt', 'Enter feet.');
    const inch = read(v.heightIn, 'heightIn', null) ?? 0;
    if (ft !== null && (!Number.isInteger(ft) || ft < 0)) errors.heightFt = 'Enter whole feet.';
    if (inch < 0 || inch >= 12) errors.heightIn = 'Inches should be from 0 to less than 12.';
    if (ft !== null && !errors.heightFt && !errors.heightIn) heightCm = feetInchesToCm(ft, inch);
  } else {
    heightCm = read(v.heightCm, 'heightCm', 'Enter your height.');
  }
  if (heightCm !== null && (heightCm < BOUNDS.heightCm.min || heightCm > BOUNDS.heightCm.max)) {
    errors.height = imperial
      ? `Height should be between ${fmtBound(cmToIn(BOUNDS.heightCm.min))} and ${fmtBound(cmToIn(BOUNDS.heightCm.max))} inches in total.`
      : `Height should be between ${BOUNDS.heightCm.min} and ${BOUNDS.heightCm.max} cm.`;
    heightCm = null;
  }

  // Weight
  const w = read(v.weight, 'weight', 'Enter your weight.');
  let weightKg: number | null = w === null ? null : imperial ? lbToKg(w) : w;
  if (weightKg !== null && (weightKg < BOUNDS.weightKg.min || weightKg > BOUNDS.weightKg.max)) {
    errors.weight = imperial
      ? `Weight should be between ${fmtBound(kgToLb(BOUNDS.weightKg.min))} and ${fmtBound(kgToLb(BOUNDS.weightKg.max))} lb.`
      : `Weight should be between ${BOUNDS.weightKg.min} and ${BOUNDS.weightKg.max} kg.`;
    weightKg = null;
  }

  // Activity
  if (!ACTIVITY_LEVELS.includes(v.activity as ActivityLevel)) errors.activity = 'Choose an activity level.';

  // Optional circumferences
  const circ = (raw: string, field: 'neck' | 'waist' | 'hip', b: { min: number; max: number }, label: string) => {
    const n = read(raw, field, null);
    if (n === null) return null;
    const cm = imperial ? inToCm(n) : n;
    if (cm < b.min || cm > b.max) {
      errors[field] = imperial
        ? `${label} should be between ${fmtBound(cmToIn(b.min))} and ${fmtBound(cmToIn(b.max))} in.`
        : `${label} should be between ${b.min} and ${b.max} cm.`;
      return null;
    }
    return cm;
  };
  const neckCm = circ(v.neck, 'neck', BOUNDS.neckCm, 'Neck');
  const waistCm = circ(v.waist, 'waist', BOUNDS.waistCm, 'Waist');
  const hipCm = circ(v.hip, 'hip', BOUNDS.hipCm, 'Hip');

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    profile: {
      age,
      sex: v.sex === '' ? null : v.sex,
      heightCm: heightCm === null ? null : roundTo(heightCm, 2),
      weightKg: weightKg === null ? null : roundTo(weightKg, 3),
      activity: v.activity === '' ? null : v.activity,
      neckCm: neckCm === null ? null : roundTo(neckCm, 2),
      waistCm: waistCm === null ? null : roundTo(waistCm, 2),
      hipCm: hipCm === null ? null : roundTo(hipCm, 2),
    },
  };
}

/** Converts whatever is currently typed when the user switches unit system. Unparseable fields are kept as typed. */
export function convertFormUnits(v: CalcFormValues, from: UnitSystem, to: UnitSystem): CalcFormValues {
  if (from === to) return v;
  const n = (raw: string) => {
    const x = parseNumberInput(raw);
    return x === null || Number.isNaN(x) ? null : x;
  };
  const toImperial = to === 'imperial';
  const conv = (raw: string, f: (x: number) => number) => {
    const x = n(raw);
    return x === null ? raw : s(f(x));
  };
  const next = { ...v };
  next.weight = conv(v.weight, toImperial ? kgToLb : lbToKg);
  next.neck = conv(v.neck, toImperial ? cmToIn : inToCm);
  next.waist = conv(v.waist, toImperial ? cmToIn : inToCm);
  next.hip = conv(v.hip, toImperial ? cmToIn : inToCm);
  if (toImperial) {
    const cm = n(v.heightCm);
    if (cm !== null) {
      const fi = cmToFeetInches(cm);
      next.heightFt = String(fi.feet);
      next.heightIn = s(fi.inches);
    }
  } else {
    const ft = n(v.heightFt);
    if (ft !== null) next.heightCm = s(feetInchesToCm(ft, n(v.heightIn) ?? 0));
  }
  return next;
}

/** Remembers the last unit switch so switching back restores untouched fields exactly. */
export interface UnitSwitchMemo {
  before: CalcFormValues;
  after: CalcFormValues;
  to: UnitSystem;
}

const LENGTH_AND_WEIGHT = ['weight', 'neck', 'waist', 'hip'] as const;

/**
 * Lossless unit switching for unsaved input. Converting always rounds for
 * display (0.1 lb, 0.1 in…), so a plain round trip can move a value
 * (178 cm → 5 ft 10.1 in → 178.1 cm). When switching back, any field the user
 * has not touched since the previous switch gets its exact original text back;
 * only edited fields are converted.
 */
export function switchFormUnits(
  v: CalcFormValues,
  from: UnitSystem,
  to: UnitSystem,
  memo: UnitSwitchMemo | null,
): { values: CalcFormValues; memo: UnitSwitchMemo | null } {
  if (from === to) return { values: v, memo };
  const out = convertFormUnits(v, from, to);
  if (memo && memo.to === from) {
    for (const f of LENGTH_AND_WEIGHT) if (v[f] === memo.after[f]) out[f] = memo.before[f];
    if (from === 'imperial') {
      if (v.heightFt === memo.after.heightFt && v.heightIn === memo.after.heightIn) out.heightCm = memo.before.heightCm;
    } else if (v.heightCm === memo.after.heightCm) {
      out.heightFt = memo.before.heightFt;
      out.heightIn = memo.before.heightIn;
    }
  }
  return { values: out, memo: { before: v, after: out, to } };
}

/** Assessment dates must be real calendar days and not in the future. Returns an error message or null. */
export function validateAssessmentDate(date: string, today: string): string | null {
  if (!isValidDayKey(date)) return 'Choose a valid date.';
  if (date > today) return 'The assessment date can’t be in the future.';
  return null;
}
