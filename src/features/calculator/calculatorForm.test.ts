import { describe, expect, it } from 'vitest';
import {
  convertFormUnits,
  parseCalcForm,
  profileToForm,
  switchFormUnits,
  validateAssessmentDate,
  type CalcFormValues,
  type UnitSwitchMemo,
} from './calculatorForm';
import { EMPTY_PROFILE } from '../../types/models';

const metric: CalcFormValues = {
  age: '35',
  sex: 'male',
  heightCm: '178',
  heightFt: '',
  heightIn: '',
  weight: '80',
  activity: 'moderate',
  neck: '',
  waist: '',
  hip: '',
};

describe('calculator form', () => {
  it('parses metric input', () => {
    const r = parseCalcForm(metric, 'metric');
    expect(r).toEqual({
      ok: true,
      profile: { age: 35, sex: 'male', heightCm: 178, weightKg: 80, activity: 'moderate', neckCm: null, waistCm: null, hipCm: null },
    });
  });

  it('converts imperial input to metric for storage', () => {
    const r = parseCalcForm({ ...metric, heightFt: '5', heightIn: '10', weight: '176.4', neck: '15', waist: '34' }, 'imperial');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.heightCm).toBeCloseTo(177.8, 1);
      expect(r.profile.weightKg).toBeCloseTo(80.01, 1);
      expect(r.profile.neckCm).toBeCloseTo(38.1, 1);
      expect(r.profile.waistCm).toBeCloseTo(86.36, 1);
    }
  });

  it('reports missing required fields and invalid numbers', () => {
    const r = parseCalcForm({ ...metric, age: '', sex: '', heightCm: 'tall', activity: '' }, 'metric');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['activity', 'age', 'heightCm', 'sex']);
    }
  });

  it('catches unit mix-ups with bounds expressed in the active unit', () => {
    const r = parseCalcForm({ ...metric, weight: '8000' }, 'metric');
    expect(!r.ok && r.errors.weight).toMatch(/kg/);
    const imp = parseCalcForm({ ...metric, heightFt: '5', heightIn: '14', weight: '10' }, 'imperial');
    expect(!imp.ok && imp.errors.heightIn).toBeTruthy();
    expect(!imp.ok && imp.errors.weight).toMatch(/lb/);
  });

  it('rejects fractional ages and out-of-range circumferences', () => {
    const r = parseCalcForm({ ...metric, age: '35.5', neck: '5' }, 'metric');
    expect(!r.ok && r.errors.age).toBeTruthy();
    expect(!r.ok && r.errors.neck).toBeTruthy();
  });

  it('allows ages under 18 to be stored (estimates are withheld elsewhere)', () => {
    expect(parseCalcForm({ ...metric, age: '16' }, 'metric').ok).toBe(true);
  });

  it('round-trips profile ↔ form in both unit systems', () => {
    const profile = { ...EMPTY_PROFILE, age: 40, sex: 'female' as const, heightCm: 165, weightKg: 62.5, activity: 'light' as const, hipCm: 98 };
    for (const units of ['metric', 'imperial'] as const) {
      const r = parseCalcForm(profileToForm(profile, units), units);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.profile.heightCm).toBeCloseTo(165, 0);
        expect(r.profile.weightKg).toBeCloseTo(62.5, 1);
        expect(r.profile.hipCm).toBeCloseTo(98, 0);
      }
    }
  });

  it('converts typed values when the unit system changes', () => {
    const imp = convertFormUnits(metric, 'metric', 'imperial');
    expect(imp.heightFt).toBe('5');
    expect(Number(imp.heightIn)).toBeCloseTo(10.1, 1);
    expect(Number(imp.weight)).toBeCloseTo(176.4, 1);
    const back = convertFormUnits(imp, 'imperial', 'metric');
    expect(Number(back.heightCm)).toBeCloseTo(178, 0);
    expect(Number(back.weight)).toBeCloseTo(80, 1);
    // Unparseable text is preserved rather than discarded.
    expect(convertFormUnits({ ...metric, weight: 'abc' }, 'metric', 'imperial').weight).toBe('abc');
  });
});

describe('unit switching keeps physical measurements stable', () => {
  const cases = [
    ['80', '178', '38', '86'],
    ['54.3', '161.5', '31.2', '70.4'],
    ['130.7', '203', '45.5', '120.9'],
    ['41', '140.2', '28', '60.1'],
  ] as const;

  it.each(cases)('weight %s kg / height %s cm return exactly as typed after ten toggles', (weight, heightCm, neck, waist) => {
    const start: CalcFormValues = { ...metric, weight, heightCm, neck, waist };
    let v = start;
    let units: 'metric' | 'imperial' = 'metric';
    let memo: UnitSwitchMemo | null = null;
    for (let i = 0; i < 10; i++) {
      const next: 'metric' | 'imperial' = units === 'metric' ? 'imperial' : 'metric';
      const r = switchFormUnits(v, units, next, memo);
      v = r.values;
      memo = r.memo;
      units = next;
    }
    expect(units).toBe('metric');
    // Every field visible in metric mode is back exactly as typed (feet/inches are hidden helpers in metric mode)…
    const { heightFt: _f, heightIn: _i, ...visible } = v;
    const { heightFt: _sf, heightIn: _si, ...startVisible } = start;
    expect(visible).toEqual(startVisible);
    // …so the measurements that would be saved are identical.
    expect(parseCalcForm(v, 'metric')).toEqual(parseCalcForm(start, 'metric'));
  });

  it('a plain conversion round trip is bounded by display rounding (why the memo exists)', () => {
    for (const [weight, heightCm] of cases) {
      const start: CalcFormValues = { ...metric, weight, heightCm };
      const back = convertFormUnits(convertFormUnits(start, 'metric', 'imperial'), 'imperial', 'metric');
      expect(Math.abs(Number(back.weight) - Number(weight))).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(Math.abs(Number(back.heightCm) - Number(heightCm))).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('converts only the fields edited after a switch and keeps the rest exact', () => {
    const start: CalcFormValues = { ...metric, weight: '80', heightCm: '178', waist: '86' };
    const toImp = switchFormUnits(start, 'metric', 'imperial', null);
    expect(toImp.values.weight).toBe('176.4');
    // User corrects the weight while in imperial.
    const edited = { ...toImp.values, weight: '180' };
    const back = switchFormUnits(edited, 'imperial', 'metric', toImp.memo);
    expect(back.values.weight).toBe('81.6');
    expect(back.values.heightCm).toBe('178');
    expect(back.values.waist).toBe('86');
  });

  it('re-displays a saved profile in either unit system from the stored metric values', () => {
    const profile = { ...EMPTY_PROFILE, age: 35, sex: 'female' as const, heightCm: 165.1, weightKg: 62.37, activity: 'light' as const, neckCm: 32, waistCm: 71, hipCm: 97 };
    const imperial = profileToForm(profile, 'imperial');
    const metricAgain = profileToForm(profile, 'metric');
    expect(metricAgain.weight).toBe('62.4');
    expect(imperial.weight).toBe('137.5');
    expect(imperial.heightFt).toBe('5');
    expect(imperial.heightIn).toBe('5');
  });
});

describe('assessment date validation', () => {
  it('accepts today and past dates', () => {
    expect(validateAssessmentDate('2026-10-10', '2026-10-10')).toBeNull();
    expect(validateAssessmentDate('2020-02-29', '2026-10-10')).toBeNull();
  });
  it('rejects future, impossible and malformed dates', () => {
    expect(validateAssessmentDate('2026-10-11', '2026-10-10')).toMatch(/future/);
    expect(validateAssessmentDate('2026-02-30', '2026-10-10')).toMatch(/valid date/);
    expect(validateAssessmentDate('1850-01-01', '2026-10-10')).toMatch(/valid date/);
    expect(validateAssessmentDate('', '2026-10-10')).toMatch(/valid date/);
    expect(validateAssessmentDate('10/10/2026', '2026-10-10')).toMatch(/valid date/);
  });
});
