import type { Assessment, FoodEntry, WeightRecord } from '../types/models';

let n = 0;

export function makeEntry(patch: Partial<FoodEntry> = {}): FoodEntry {
  n += 1;
  return {
    id: `e${n}`,
    date: '2026-10-10',
    meal: 'lunch',
    name: `Food ${n}`,
    quantity: 1,
    unit: 'serving',
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 5,
    fiber: null,
    notes: '',
    source: 'manual',
    createdAt: '2026-10-10T12:00:00.000Z',
    updatedAt: '2026-10-10T12:00:00.000Z',
    ...patch,
  };
}

export function makeWeight(patch: Partial<WeightRecord> = {}): WeightRecord {
  n += 1;
  return {
    id: `w${n}`,
    date: '2026-10-01',
    weightKg: 80,
    note: '',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...patch,
  };
}

export function makeAssessment(patch: Partial<Assessment> = {}): Assessment {
  n += 1;
  return {
    id: `a${n}`,
    date: '2026-10-01',
    inputs: {
      age: 30,
      sex: 'male',
      heightCm: 180,
      weightKg: 80,
      activity: 'moderate',
      neckCm: null,
      waistCm: null,
      hipCm: null,
    },
    results: {
      equation: 'mifflin-st-jeor',
      bmr: 1780,
      activityMultiplier: 1.55,
      tdee: 2759,
      bodyFatPercent: null,
      leanMassKg: null,
      katchMcArdleBmr: null,
      katchMcArdleTdee: null,
    },
    notes: '',
    createdAt: '2026-10-01T08:00:00.000Z',
    ...patch,
  };
}
