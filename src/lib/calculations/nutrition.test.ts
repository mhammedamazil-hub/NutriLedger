import { describe, expect, it } from 'vitest';
import { makeEntry } from '../../test/factories';
import { averageLoggedCalories, dailySeries, scaleNutrition, sumMacro, totalsFor } from './nutrition';

describe('portion scaling', () => {
  it('scales reference nutrition by eaten ÷ reference quantity', () => {
    // Label: per 100 g → 250 kcal, 8 g protein; ate 150 g.
    const r = scaleNutrition({ calories: 250, protein: 8, carbs: 40, fat: 6, fiber: null }, 100, 150);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.calories).toBeCloseTo(375, 10);
      expect(r.value.protein).toBeCloseTo(12, 10);
      expect(r.value.carbs).toBeCloseTo(60, 10);
      expect(r.value.fat).toBeCloseTo(9, 10);
      expect(r.value.fiber).toBeNull();
    }
  });
  it('rejects zero or invalid quantities', () => {
    const ref = { calories: 100, protein: null, carbs: null, fat: null, fiber: null };
    expect(scaleNutrition(ref, 0, 50).ok).toBe(false);
    expect(scaleNutrition(ref, 100, -1).ok).toBe(false);
    expect(scaleNutrition(ref, Number.NaN, 1).ok).toBe(false);
    expect(scaleNutrition({ ...ref, calories: Number.NaN }, 100, 1).ok).toBe(false);
  });
});

describe('daily totals', () => {
  it('sums calories', () => {
    const t = totalsFor([makeEntry({ calories: 320 }), makeEntry({ calories: 480.5 }), makeEntry({ calories: 0 })]);
    expect(t.calories).toBeCloseTo(800.5, 10);
    expect(t.entryCount).toBe(3);
  });

  it('does not treat missing macros as zero and flags incompleteness', () => {
    const entries = [makeEntry({ protein: 20 }), makeEntry({ protein: null }), makeEntry({ protein: 5 })];
    const m = sumMacro(entries, 'protein');
    expect(m).toEqual({ total: 25, recordedCount: 2, complete: false });
  });

  it('marks complete only when all entries recorded the macro', () => {
    expect(sumMacro([makeEntry({ fat: 1 }), makeEntry({ fat: 0 })], 'fat').complete).toBe(true);
    expect(sumMacro([], 'fat').complete).toBe(false);
  });
});

describe('daily series', () => {
  it('represents unlogged days as null, not zero', () => {
    const series = dailySeries(
      [makeEntry({ date: '2026-10-08', calories: 1500 }), makeEntry({ date: '2026-10-10', calories: 2000 })],
      ['2026-10-08', '2026-10-09', '2026-10-10'],
    );
    expect(series.map((p) => p.calories)).toEqual([1500, null, 2000]);
    expect(series[1]?.entryCount).toBe(0);
    expect(averageLoggedCalories(series)).toBe(1750);
  });

  it('returns null average when nothing was logged', () => {
    expect(averageLoggedCalories(dailySeries([], ['2026-10-10']))).toBeNull();
  });
});
