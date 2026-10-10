import { describe, expect, it } from 'vitest';
import { parseTargets } from './targetsForm';

describe('targets form', () => {
  it('treats empty fields as "no target" rather than zero', () => {
    expect(parseTargets({ calories: '', protein: '', carbs: '', fat: '' })).toEqual({
      ok: true,
      value: { calories: null, protein: null, carbs: null, fat: null },
    });
  });
  it('rounds and validates ranges', () => {
    expect(parseTargets({ calories: '2100.4', protein: '120', carbs: '', fat: '70' })).toEqual({
      ok: true,
      value: { calories: 2100, protein: 120, carbs: null, fat: 70 },
    });
    const bad = parseTargets({ calories: '200', protein: 'x', carbs: '-1', fat: '' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['calories', 'carbs', 'protein']);
  });
});
