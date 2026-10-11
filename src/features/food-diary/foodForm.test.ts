import { describe, expect, it } from 'vitest';
import { emptyFoodForm, parseFoodForm } from './foodForm';

const base = () => ({ ...emptyFoodForm('2026-10-10'), name: 'Greek yogurt', calories: '146', quantity: '170', unit: 'g' });

describe('food form parsing', () => {
  it('accepts a valid entry and keeps unrecorded macros as null', () => {
    const r = parseFoodForm({ ...base(), protein: '15.5' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.protein).toBe(15.5);
      expect(r.value.carbs).toBeNull();
      expect(r.value.calories).toBe(146);
    }
  });

  it('requires a name and calories', () => {
    const r = parseFoodForm({ ...base(), name: '  ', calories: '' });
    expect(r).toMatchObject({ ok: false, errors: { name: expect.any(String), calories: expect.any(String) } });
  });

  it('rejects text, negative and extreme values with field errors', () => {
    const r = parseFoodForm({ ...base(), calories: 'lots', protein: '-3', fat: '5000', quantity: '0' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.calories).toMatch(/number/);
      expect(r.errors.protein).toBeDefined();
      expect(r.errors.fat).toBeDefined();
      expect(r.errors.quantity).toBeDefined();
    }
  });

  it('rejects invalid dates and overlong names', () => {
    expect(parseFoodForm({ ...base(), date: '2026-02-30' }).ok).toBe(false);
    expect(parseFoodForm({ ...base(), name: 'x'.repeat(200) }).ok).toBe(false);
  });

  it('accepts decimal commas', () => {
    const r = parseFoodForm({ ...base(), calories: '146,5' });
    expect(r.ok && r.value.calories).toBe(146.5);
  });
});
