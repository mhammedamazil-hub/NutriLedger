import { describe, expect, it } from 'vitest';
import { parseWeightForm, weightToDisplay } from './weightForm';

describe('weight form', () => {
  it('stores imperial input as kilograms', () => {
    const r = parseWeightForm({ date: '2026-10-01', weight: '165', note: ' after run ' }, 'imperial', '2026-10-10');
    expect(r.ok && r.value.weightKg).toBeCloseTo(74.843, 2);
    expect(r.ok && r.value.note).toBe('after run');
  });
  it('rejects future dates, blanks and implausible values', () => {
    const r = parseWeightForm({ date: '2026-10-11', weight: '', note: '' }, 'metric', '2026-10-10');
    expect(r).toMatchObject({ ok: false, errors: { date: expect.any(String), weight: expect.any(String) } });
    expect(parseWeightForm({ date: '2026-10-01', weight: '7000', note: '' }, 'metric', '2026-10-10').ok).toBe(false);
  });
  it('round-trips display values', () => {
    expect(weightToDisplay(80, 'imperial')).toBe('176.4');
    expect(weightToDisplay(80, 'metric')).toBe('80');
  });
});
