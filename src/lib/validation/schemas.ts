import { z } from 'zod';
import {
  ACTIVITY_LEVELS,
  NUTRITION_SOURCES,
  type Assessment,
  type FoodEntry,
  type Profile,
  type Targets,
  type WeightRecord,
} from '../../types/models';
import { isValidDayKey } from '../formatting/dates';
import { BOUNDS } from './bounds';

export const dayKeySchema = z
  .string({ error: 'Enter a date.' })
  .refine(isValidDayKey, { message: 'Enter a valid date.' });

export const isoTimestampSchema = z
  .string()
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid timestamp.' });

const idSchema = z.string().min(1).max(100);

const num = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label} must be a number.` })
    .refine(Number.isFinite, { message: `${label} must be a finite number.` })
    .refine((n) => n >= min && n <= max, { message: `${label} must be between ${min} and ${max}.` });

const positiveNum = (max: number, label: string) =>
  z
    .number({ error: `${label} must be a number.` })
    .refine(Number.isFinite, { message: `${label} must be a finite number.` })
    .refine((n) => n > 0 && n <= max, { message: `${label} must be greater than 0 and at most ${max}.` });

export const mealSchema = z
  .string()
  .trim()
  .min(1, 'Choose a meal.')
  .max(BOUNDS.text.meal, `Meal names can be up to ${BOUNDS.text.meal} characters.`);

export const foodEntryFieldsSchema = z.object({
  date: dayKeySchema,
  meal: mealSchema,
  name: z
    .string()
    .trim()
    .min(1, 'Enter a food name.')
    .max(BOUNDS.text.name, `Food names can be up to ${BOUNDS.text.name} characters.`),
  quantity: positiveNum(BOUNDS.quantity.max, 'Quantity').nullable(),
  unit: z.string().trim().max(BOUNDS.text.unit, 'Unit is too long.'),
  calories: num(BOUNDS.calories.min, BOUNDS.calories.max, 'Calories'),
  protein: num(BOUNDS.macroG.min, BOUNDS.macroG.max, 'Protein').nullable(),
  carbs: num(BOUNDS.macroG.min, BOUNDS.macroG.max, 'Carbohydrates').nullable(),
  fat: num(BOUNDS.macroG.min, BOUNDS.macroG.max, 'Fat').nullable(),
  fiber: num(BOUNDS.fiberG.min, BOUNDS.fiberG.max, 'Fiber').nullable(),
  notes: z.string().max(BOUNDS.text.notes, 'Notes are too long.'),
  source: z.enum(NUTRITION_SOURCES),
});

export const foodEntrySchema = foodEntryFieldsSchema.extend({
  id: idSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
}) satisfies z.ZodType<FoodEntry>;

export const profileSchema = z.object({
  age: num(BOUNDS.age.min, BOUNDS.age.max, 'Age').nullable(),
  sex: z.enum(['male', 'female']).nullable(),
  heightCm: num(BOUNDS.heightCm.min, BOUNDS.heightCm.max, 'Height').nullable(),
  weightKg: num(BOUNDS.weightKg.min, BOUNDS.weightKg.max, 'Weight').nullable(),
  activity: z.enum(ACTIVITY_LEVELS).nullable(),
  neckCm: num(BOUNDS.neckCm.min, BOUNDS.neckCm.max, 'Neck').nullable(),
  waistCm: num(BOUNDS.waistCm.min, BOUNDS.waistCm.max, 'Waist').nullable(),
  hipCm: num(BOUNDS.hipCm.min, BOUNDS.hipCm.max, 'Hip').nullable(),
  updatedAt: isoTimestampSchema.nullable(),
}) satisfies z.ZodType<Profile>;

export const targetsSchema = z.object({
  calories: num(BOUNDS.targetCalories.min, BOUNDS.targetCalories.max, 'Calorie target').nullable(),
  calorieSource: z.enum(['manual', 'tdee-estimate']).nullable(),
  protein: num(BOUNDS.targetMacroG.min, BOUNDS.targetMacroG.max, 'Protein target').nullable(),
  carbs: num(BOUNDS.targetMacroG.min, BOUNDS.targetMacroG.max, 'Carbohydrate target').nullable(),
  fat: num(BOUNDS.targetMacroG.min, BOUNDS.targetMacroG.max, 'Fat target').nullable(),
  updatedAt: isoTimestampSchema.nullable(),
}) satisfies z.ZodType<Targets>;

const nullableCircumference = (b: { min: number; max: number }, label: string) =>
  num(b.min, b.max, label).nullable();

export const assessmentSchema = z.object({
  id: idSchema,
  date: dayKeySchema,
  inputs: z.object({
    age: num(18, BOUNDS.age.max, 'Age'),
    sex: z.enum(['male', 'female']),
    heightCm: num(BOUNDS.heightCm.min, BOUNDS.heightCm.max, 'Height'),
    weightKg: num(BOUNDS.weightKg.min, BOUNDS.weightKg.max, 'Weight'),
    activity: z.enum(ACTIVITY_LEVELS),
    neckCm: nullableCircumference(BOUNDS.neckCm, 'Neck'),
    waistCm: nullableCircumference(BOUNDS.waistCm, 'Waist'),
    hipCm: nullableCircumference(BOUNDS.hipCm, 'Hip'),
  }),
  results: z.object({
    equation: z.literal('mifflin-st-jeor'),
    bmr: num(300, 10000, 'BMR'),
    activityMultiplier: num(1, 3, 'Activity multiplier'),
    tdee: num(300, 20000, 'TDEE'),
    bodyFatPercent: num(0, 100, 'Body fat').nullable(),
    leanMassKg: num(0, 500, 'Lean mass').nullable(),
    katchMcArdleBmr: num(300, 10000, 'Katch–McArdle BMR').nullable(),
    katchMcArdleTdee: num(300, 20000, 'Katch–McArdle TDEE').nullable(),
  }),
  notes: z.string().max(BOUNDS.text.notes),
  createdAt: isoTimestampSchema,
}) satisfies z.ZodType<Assessment>;

export const weightRecordSchema = z.object({
  id: idSchema,
  date: dayKeySchema,
  weightKg: num(BOUNDS.weightKg.min, BOUNDS.weightKg.max, 'Weight'),
  note: z.string().max(BOUNDS.text.notes),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
}) satisfies z.ZodType<WeightRecord>;

export const customMealsSchema = z
  .array(mealSchema)
  .max(BOUNDS.customMeals, `Up to ${BOUNDS.customMeals} custom meals are supported.`);

/** Maps Zod issues to a { field: firstMessage } record for inline form errors. */
export function issuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : '_form';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
