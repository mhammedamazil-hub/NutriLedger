import type { Assessment, FoodEntry, WeightRecord } from '../../types/models';
import { groupByDate, totalsFor } from '../calculations/nutrition';
import { ACTIVITY_INFO } from '../calculations/energy';
import { kgToLb } from '../calculations/units';
import { mealLabel } from '../meals';
import { roundTo } from '../formatting/numbers';

type Cell = string | number | null | undefined;

/** Characters that make spreadsheet apps interpret a cell as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r|%]/;

/**
 * Escapes one CSV cell (RFC 4180) and neutralises spreadsheet formula
 * injection: user-controlled text beginning with = + - @ tab CR | or % is
 * prefixed with an apostrophe so Excel/LibreOffice/Sheets show it as text.
 * Numbers are emitted as plain numbers and are never prefixed.
 */
export function escapeCsvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let s = value;
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: readonly string[], rows: readonly Cell[][]): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsvCell).join(','));
  // CRLF per RFC 4180; a BOM lets Excel detect UTF-8 for non-ASCII food names.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

const r1 = (n: number | null): number | null => (n === null ? null : roundTo(n, 1));

export const FOOD_CSV_HEADERS = [
  'date',
  'meal',
  'food',
  'quantity',
  'unit',
  'calories_kcal',
  'protein_g',
  'carbohydrate_g',
  'fat_g',
  'fiber_g',
  'nutrition_source',
  'notes',
  'created_at',
  'updated_at',
] as const;

export function foodEntriesToCsv(entries: readonly FoodEntry[]): string {
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  return toCsv(
    FOOD_CSV_HEADERS,
    sorted.map((e) => [
      e.date,
      mealLabel(e.meal),
      e.name,
      e.quantity,
      e.unit,
      r1(e.calories),
      r1(e.protein),
      r1(e.carbs),
      r1(e.fat),
      r1(e.fiber),
      e.source === 'ai-estimate' ? 'AI estimate (user reviewed)' : e.source === 'label' ? 'Food label' : 'Manual entry',
      e.notes,
      e.createdAt,
      e.updatedAt,
    ]),
  );
}

export const DAILY_CSV_HEADERS = [
  'date',
  'entries',
  'calories_kcal',
  'protein_g',
  'protein_entries_recorded',
  'carbohydrate_g',
  'carbohydrate_entries_recorded',
  'fat_g',
  'fat_entries_recorded',
  'fiber_g',
  'fiber_entries_recorded',
] as const;

/** One row per logged day. Unlogged days are omitted rather than written as zero. */
export function dailyTotalsToCsv(entries: readonly FoodEntry[]): string {
  const byDate = groupByDate(entries);
  const days = [...byDate.keys()].sort();
  // totalsFor is the same function the diary, dashboard and charts use.
  const rows = days.map((d) => {
    const t = totalsFor(byDate.get(d) ?? []);
    return [
      d,
      t.entryCount,
      r1(t.calories),
      t.protein.recordedCount ? r1(t.protein.total) : null,
      t.protein.recordedCount,
      t.carbs.recordedCount ? r1(t.carbs.total) : null,
      t.carbs.recordedCount,
      t.fat.recordedCount ? r1(t.fat.total) : null,
      t.fat.recordedCount,
      t.fiber.recordedCount ? r1(t.fiber.total) : null,
      t.fiber.recordedCount,
    ];
  });
  return toCsv(DAILY_CSV_HEADERS, rows);
}

export const WEIGHT_CSV_HEADERS = ['date', 'weight_kg', 'weight_lb', 'note'] as const;

export function weightsToCsv(weights: readonly WeightRecord[]): string {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return toCsv(
    WEIGHT_CSV_HEADERS,
    sorted.map((w) => [w.date, roundTo(w.weightKg, 2), roundTo(kgToLb(w.weightKg), 2), w.note]),
  );
}

export const ASSESSMENT_CSV_HEADERS = [
  'date',
  'age_years',
  'equation_variant',
  'height_cm',
  'weight_kg',
  'activity_level',
  'activity_multiplier',
  'bmr_mifflin_st_jeor_kcal',
  'tdee_kcal',
  'body_fat_percent_navy',
  'lean_mass_kg',
  'bmr_katch_mcardle_kcal',
  'notes',
] as const;

export function assessmentsToCsv(assessments: readonly Assessment[]): string {
  const sorted = [...assessments].sort((a, b) => a.date.localeCompare(b.date));
  return toCsv(
    ASSESSMENT_CSV_HEADERS,
    sorted.map((a) => [
      a.date,
      a.inputs.age,
      a.inputs.sex,
      roundTo(a.inputs.heightCm, 1),
      roundTo(a.inputs.weightKg, 2),
      ACTIVITY_INFO[a.inputs.activity].label,
      a.results.activityMultiplier,
      Math.round(a.results.bmr),
      Math.round(a.results.tdee),
      r1(a.results.bodyFatPercent),
      r1(a.results.leanMassKg),
      a.results.katchMcArdleBmr === null ? null : Math.round(a.results.katchMcArdleBmr),
      a.notes,
    ]),
  );
}
