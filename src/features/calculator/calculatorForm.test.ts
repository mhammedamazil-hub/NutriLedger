import { describe, expect, it } from 'vitest';
import { convertFormUnits, parseCalcForm, profileToForm, type CalcFormValues } from './calculatorForm';
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
