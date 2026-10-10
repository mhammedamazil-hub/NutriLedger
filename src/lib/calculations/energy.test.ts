import { describe, expect, it } from 'vitest';
import { ACTIVITY_INFO, energyBalance, katchMcArdle, mifflinStJeor, tdee } from './energy';
import { ACTIVITY_LEVELS } from '../../types/models';

describe('Mifflin–St Jeor', () => {
  it('computes the male equation exactly', () => {
    // 10×80 + 6.25×180 − 5×30 + 5 = 800 + 1125 − 150 + 5 = 1780
    const r = mifflinStJeor({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 });
    expect(r).toEqual({ ok: true, value: 1780 });
  });

  it('computes the female equation exactly', () => {
    // 10×60 + 6.25×165 − 5×40 − 161 = 600 + 1031.25 − 200 − 161 = 1270.25
    const r = mifflinStJeor({ sex: 'female', age: 40, heightCm: 165, weightKg: 60 });
    expect(r.ok && r.value).toBeCloseTo(1270.25, 10);
  });

  it('refuses to estimate for people under 18', () => {
    const r = mifflinStJeor({ sex: 'female', age: 16, heightCm: 160, weightKg: 55 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe('age');
      expect(r.reason).toMatch(/adults/);
    }
  });

  it.each([
    [{ age: Number.NaN }, 'age'],
    [{ heightCm: Number.POSITIVE_INFINITY }, 'height'],
    [{ weightKg: 0 }, 'weight'],
    [{ weightKg: -70 }, 'weight'],
    [{ heightCm: 20 }, 'height'],
    [{ weightKg: 900 }, 'weight'],
    [{ age: 150 }, 'age'],
  ])('rejects invalid input %j', (patch, field) => {
    const r = mifflinStJeor({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe(field);
  });

  it('rejects a missing sex selection', () => {
    const r = mifflinStJeor({ sex: undefined as unknown as 'male', age: 30, heightCm: 180, weightKg: 80 });
    expect(r.ok).toBe(false);
  });
});

describe('TDEE', () => {
  it.each([
    ['sedentary', 1.2, 2136],
    ['light', 1.375, 2447.5],
    ['moderate', 1.55, 2759],
    ['very', 1.725, 3070.5],
    ['extra', 1.9, 3382],
  ] as const)('%s uses multiplier %s', (level, multiplier, expected) => {
    expect(ACTIVITY_INFO[level].multiplier).toBe(multiplier);
    const r = tdee(1780, level);
    expect(r.ok && r.value).toBeCloseTo(expected, 8);
  });

  it('covers every activity level', () => {
    for (const level of ACTIVITY_LEVELS) expect(ACTIVITY_INFO[level]).toBeDefined();
  });

  it('rejects non-positive or non-finite BMR', () => {
    expect(tdee(0, 'light').ok).toBe(false);
    expect(tdee(Number.NaN, 'light').ok).toBe(false);
    expect(tdee(1500, 'unknown' as 'light').ok).toBe(false);
  });
});

describe('Katch–McArdle', () => {
  it('computes 370 + 21.6 × LBM', () => {
    const r = katchMcArdle(60);
    expect(r.ok && r.value).toBeCloseTo(1666, 10);
  });
  it('rejects implausible lean mass', () => {
    expect(katchMcArdle(0).ok).toBe(false);
    expect(katchMcArdle(Number.NaN).ok).toBe(false);
    expect(katchMcArdle(500).ok).toBe(false);
  });
});

describe('energy balance', () => {
  it('is intake minus TDEE (negative when below)', () => {
    const r = energyBalance(1800, 2400);
    expect(r).toEqual({ ok: true, value: -600 });
  });
  it('is positive when intake exceeds estimate', () => {
    const r = energyBalance(2600, 2400);
    expect(r.ok && r.value).toBe(200);
  });
  it('requires a valid TDEE and intake', () => {
    expect(energyBalance(1800, 0).ok).toBe(false);
    expect(energyBalance(-1, 2000).ok).toBe(false);
    expect(energyBalance(Number.POSITIVE_INFINITY, 2000).ok).toBe(false);
  });
});
