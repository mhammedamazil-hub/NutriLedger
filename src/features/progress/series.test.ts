import { describe, expect, it } from 'vitest';
import { rangeDays, rangeStart, weeklyBuckets } from './series';
import type { DailyPoint } from '../../lib/calculations/nutrition';

const day = (date: string, calories: number | null, protein: number | null = null): DailyPoint => ({
  date,
  calories,
  protein,
  carbs: null,
  fat: null,
  entryCount: calories === null ? 0 : 1,
  macrosIncomplete: calories !== null,
});

describe('progress ranges', () => {
  it('computes inclusive fixed ranges', () => {
    expect(rangeStart('7d', '2026-10-10', null)).toBe('2026-10-04');
    expect(rangeDays('30d', '2026-10-10', null)).toHaveLength(30);
    expect(rangeDays('1y', '2026-10-10', null)).toHaveLength(365);
  });

  it('"All" starts at the earliest record and never after today', () => {
    expect(rangeDays('all', '2026-10-10', '2026-10-01')).toHaveLength(10);
    expect(rangeDays('all', '2026-10-10', null)).toEqual(['2026-10-10']);
    expect(rangeDays('all', '2026-10-10', '2027-01-01')).toEqual(['2026-10-10']);
  });

  it('crosses month and DST boundaries without skipping days', () => {
    const days = rangeDays('7d', '2026-11-03', null);
    expect(days).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
  });
});

describe('weekly buckets', () => {
  it('averages logged days only and keeps empty weeks as null', () => {
    const points = [
      day('2026-01-01', 2000, 100),
      day('2026-01-02', null),
      day('2026-01-03', 1000, null),
      day('2026-01-04', null),
      day('2026-01-05', null),
      day('2026-01-06', null),
      day('2026-01-07', null),
      day('2026-01-08', null),
      day('2026-01-09', null),
    ];
    const [w1, w2] = weeklyBuckets(points);
    expect(w1).toMatchObject({ start: '2026-01-01', end: '2026-01-07', calories: 1500, protein: 100, loggedDays: 2, totalDays: 7 });
    expect(w2).toMatchObject({ start: '2026-01-08', end: '2026-01-09', calories: null, loggedDays: 0, totalDays: 2 });
  });
});
