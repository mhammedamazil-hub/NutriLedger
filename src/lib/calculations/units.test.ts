import { describe, expect, it } from 'vitest';
import { cmToFeetInches, cmToIn, feetInchesToCm, inToCm, kgToLb, lbToKg } from './units';

describe('unit conversions', () => {
  it('converts kg ↔ lb with the exact definition', () => {
    expect(kgToLb(1)).toBeCloseTo(2.20462262, 8);
    expect(lbToKg(100)).toBeCloseTo(45.359237, 10);
  });

  it('round-trips kg → lb → kg without drift', () => {
    for (const kg of [45.3, 70, 82.75, 133.333]) expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 10);
  });

  it('round-trips cm → in → cm without drift', () => {
    for (const cm of [152.4, 175, 181.3]) expect(inToCm(cmToIn(cm))).toBeCloseTo(cm, 10);
    expect(cmToIn(2.54)).toBe(1);
  });

  it('splits and rebuilds feet + inches', () => {
    const { feet, inches } = cmToFeetInches(180);
    expect(feet).toBe(5);
    expect(inches).toBeCloseTo(10.866, 3);
    expect(feetInchesToCm(feet, inches)).toBeCloseTo(180, 10);
  });

  it('never displays 12 inches', () => {
    // 182.88 cm is exactly 6 ft; values just below would round to 12.0 in.
    const just = feetInchesToCm(5, 11.99);
    expect(cmToFeetInches(just)).toEqual({ feet: 6, inches: 0 });
  });
});
