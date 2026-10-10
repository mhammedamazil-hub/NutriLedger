/**
 * Core NutriLedger data model.
 *
 * Storage conventions (never change without a migration):
 * - Body measurements are stored in metric units (kg, cm). Imperial is a
 *   display/input concern only and is converted at the UI boundary.
 * - Dates that identify a calendar day are stored as local `YYYY-MM-DD` keys
 *   (not ISO timestamps) so an entry never shifts day because of time zones.
 * - Timestamps (`createdAt`, `updatedAt`) are ISO-8601 strings in UTC.
 * - A `null` macro means "not recorded" — it is never treated as zero.
 */

export type Sex = 'male' | 'female';

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'very', 'extra'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const DEFAULT_MEALS = ['breakfast', 'lunch', 'dinner', 'snacks', 'other'] as const;
export type DefaultMeal = (typeof DEFAULT_MEALS)[number];

/** Where an entry's nutrition values came from. */
export const NUTRITION_SOURCES = ['manual', 'label', 'ai-estimate'] as const;
export type NutritionSource = (typeof NUTRITION_SOURCES)[number];

export interface FoodEntry {
  id: string;
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  /** One of DEFAULT_MEALS or a user-defined custom meal label. */
  meal: string;
  name: string;
  /** Amount eaten, in `unit`. Null when the user did not record an amount. */
  quantity: number | null;
  /** Free-form portion unit (g, ml, cup, piece, serving…). No automatic conversion is applied. */
  unit: string;
  /** Energy for the whole recorded portion, kcal. */
  calories: number;
  /** Grams for the whole recorded portion; null = not recorded. */
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  notes: string;
  source: NutritionSource;
  createdAt: string;
  updatedAt: string;
}

export type FoodEntryInput = Omit<FoodEntry, 'id' | 'createdAt' | 'updatedAt'>;

export interface Profile {
  age: number | null;
  sex: Sex | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: ActivityLevel | null;
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  updatedAt: string | null;
}

export type CalorieTargetSource = 'manual' | 'tdee-estimate';

export interface Targets {
  calories: number | null;
  calorieSource: CalorieTargetSource | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  updatedAt: string | null;
}

export interface AssessmentInputs {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
}

export interface AssessmentResults {
  equation: 'mifflin-st-jeor';
  bmr: number;
  activityMultiplier: number;
  tdee: number;
  bodyFatPercent: number | null;
  leanMassKg: number | null;
  katchMcArdleBmr: number | null;
  katchMcArdleTdee: number | null;
}

export interface Assessment {
  id: string;
  /** Assessment date chosen by the user, YYYY-MM-DD. */
  date: string;
  inputs: AssessmentInputs;
  results: AssessmentResults;
  notes: string;
  createdAt: string;
}

export interface WeightRecord {
  id: string;
  date: string;
  weightKg: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';
export type UnitSystem = 'metric' | 'imperial';

export interface Preferences {
  theme: ThemePreference;
  units: UnitSystem;
  aiModel: string;
}

export const EMPTY_PROFILE: Profile = {
  age: null,
  sex: null,
  heightCm: null,
  weightKg: null,
  activity: null,
  neckCm: null,
  waistCm: null,
  hipCm: null,
  updatedAt: null,
};

export const EMPTY_TARGETS: Targets = {
  calories: null,
  calorieSource: null,
  protein: null,
  carbs: null,
  fat: null,
  updatedAt: null,
};
