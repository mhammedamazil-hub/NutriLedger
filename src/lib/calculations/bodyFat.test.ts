import { describe, expect, it } from 'vitest';
import { leanBodyMass, navyBodyFat } from './bodyFat';

/** Original Hodgdon & Beckett inch-based forms, used as an independent cross-check. */
const inch = (cm: number) => cm / 2.54;
const maleInches = (h: number, n: number, w: number) =>
  86.01 * Math.log10(inch(w) - inch(n)) - 70.041 * Math.log10(inch(h)) + 36.76;
const femaleInches = (h: number, n: number, w: number, hip: number) =>
  163.205 * Math.log10(inch(w) + inch(hip) - inch(n)) - 97.684 * Math.log10(inch(h)) - 78.387;

describe('U.S. Navy body-fat estimate', () => {
  it('computes the male equation (metric form)', () => {
    const r = navyBodyFat({ sex: 'male', heightCm: 178, neckCm: 38, waistCm: 86, hipCm: null });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const expected = 495 / (1.0324 - 0.19077 * Math.log10(48) + 0.15456 * Math.log10(178)) - 450;
      expect(r.value).toBeCloseTo(expected, 10);
      expect(r.value).toBeCloseTo(17.2, 1);
      // Agrees with the inch-based publication form within half a percentage point.
      expect(Math.abs(r.value - maleInches(178, 38, 86))).toBeLessThan(0.5);
    }
  });

  it('computes the female equation using hip (not chest)', () => {
    const r = navyBodyFat({ sex: 'female', heightCm: 165, neckCm: 33, waistCm: 75, hipCm: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const expected = 495 / (1.29579 - 0.35004 * Math.log10(142) + 0.221 * Math.log10(165)) - 450;
      expect(r.value).toBeCloseTo(expected, 10);
      expect(Math.abs(r.value - femaleInches(165, 33, 75, 100))).toBeLessThan(0.7);
    }
  });

  it('requires hip circumference for the female equation', () => {
    const r = navyBodyFat({ sex: 'female', heightCm: 165, neckCm: 33, waistCm: 75, hipCm: null });
    expect(r).toMatchObject({ ok: false, field: 'hip' });
  });

  it('reports missing neck or waist measurements', () => {
    expect(navyBodyFat({ sex: 'male', heightCm: 178, neckCm: null, waistCm: 86, hipCm: null })).toMatchObject({
      ok: false,
      field: 'neck',
    });
    expect(navyBodyFat({ sex: 'male', heightCm: 178, neckCm: 38, waistCm: null, hipCm: null })).toMatchObject({
      ok: false,
      field: 'waist',
    });
  });

  it('rejects a non-positive logarithm argument (waist ≤ neck)', () => {
    const r = navyBodyFat({ sex: 'male', heightCm: 178, neckCm: 45, waistCm: 45, hipCm: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/larger than neck/);
  });

  it('rejects zero, negative, NaN and infinite measurements', () => {
    for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(navyBodyFat({ sex: 'male', heightCm: 178, neckCm: bad, waistCm: 86, hipCm: null }).ok).toBe(false);
    }
    expect(navyBodyFat({ sex: 'male', heightCm: 0, neckCm: 38, waistCm: 86, hipCm: null }).ok).toBe(false);
  });

  it('rejects implausible results that indicate a measurement error', () => {
    // Waist barely above neck gives an absurdly low (negative) estimate.
    const r = navyBodyFat({ sex: 'male', heightCm: 190, neckCm: 40, waistCm: 42, hipCm: null });
    expect(r.ok).toBe(false);
  });
});

describe('lean body mass', () => {
  it('derives from weight and body fat', () => {
    const r = leanBodyMass(80, 20);
    expect(r.ok && r.value).toBeCloseTo(64, 10);
  });
  it('requires a valid body-fat estimate', () => {
    expect(leanBodyMass(80, Number.NaN).ok).toBe(false);
    expect(leanBodyMass(80, 90).ok).toBe(false);
    expect(leanBodyMass(0, 20).ok).toBe(false);
  });
});
