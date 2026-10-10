import type { AssessmentInputs, AssessmentResults, FoodEntry } from '../../types/models';
import { ACTIVITY_INFO } from '../calculations/energy';
import { groupByDate, totalsFor } from '../calculations/nutrition';
import { roundTo } from '../formatting/numbers';

const r0 = (n: number) => String(Math.round(n));
const r1 = (n: number) => String(roundTo(n, 1));

/**
 * Builds the exact, locally computed facts sent to Gemini for an explanation.
 * Only the values needed to explain the formula are included.
 */
export function buildCalculationFacts(inputs: AssessmentInputs, results: AssessmentResults): string {
  const act = ACTIVITY_INFO[inputs.activity];
  const variant = inputs.sex === 'male' ? '+ 5 (male variant)' : '− 161 (female variant)';
  const lines = [
    `Equation: Mifflin–St Jeor, ${inputs.sex} variant.`,
    `Inputs: weight ${r1(inputs.weightKg)} kg, height ${r1(inputs.heightCm)} cm, age ${r0(inputs.age)} years.`,
    `BMR = 10 × ${r1(inputs.weightKg)} + 6.25 × ${r1(inputs.heightCm)} − 5 × ${r0(inputs.age)} ${variant} = ${r0(results.bmr)} kcal/day.`,
    `Activity level: ${act.label} (${act.description}) multiplier ${act.multiplier}.`,
    `TDEE = ${r0(results.bmr)} × ${act.multiplier} = ${r0(results.tdee)} kcal/day.`,
  ];
  if (results.bodyFatPercent !== null) {
    lines.push(`U.S. Navy circumference body-fat estimate: ${r1(results.bodyFatPercent)} %.`);
  }
  if (results.leanMassKg !== null && results.katchMcArdleBmr !== null) {
    lines.push(
      `Lean body mass = weight × (1 − body fat) = ${r1(results.leanMassKg)} kg. Katch–McArdle BMR = 370 + 21.6 × ${r1(results.leanMassKg)} = ${r0(results.katchMcArdleBmr)} kcal/day.`,
    );
  }
  return lines.join('\n');
}

/** Numbers (≥ 10) that appear in `text` but not in `facts` — used to flag explanations that drift. */
export function findUnexpectedNumbers(text: string, facts: string): string[] {
  const norm = (s: string) => s.replace(/(\d),(\d{3})/g, '$1$2');
  const allowed = new Set((norm(facts).match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n))));
  const found = norm(text).match(/\d+(?:\.\d+)?/g) ?? [];
  const unexpected = new Set<string>();
  for (const n of found) {
    const v = Number(n);
    // Ignore small counts ("3 days", "18 years" are in facts anyway) and common reference numbers.
    if (v < 100 || allowed.has(String(v)) || v === 1200 || v === 1990) continue;
    unexpected.add(n);
  }
  return [...unexpected];
}

export interface SummaryOptions {
  includeFoodNames: boolean;
}

/**
 * The exact text sent for "Summarise my records": per-day totals only by
 * default; food names only if the user ticks the box. Notes are never included.
 */
export function buildSummaryPayload(
  entries: readonly FoodEntry[],
  start: string,
  end: string,
  options: SummaryOptions,
  calorieTarget: number | null,
): { text: string; loggedDays: number } {
  const inRange = entries.filter((e) => e.date >= start && e.date <= end);
  const byDate = groupByDate(inRange);
  const days = [...byDate.keys()].sort();
  const lines = [
    `Date range: ${start} to ${end}. Days with entries: ${days.length}. Unlisted days were not logged.`,
  ];
  if (calorieTarget !== null) lines.push(`User-configured daily calorie target: ${r0(calorieTarget)} kcal.`);
  lines.push('Per-day recorded totals (macros include only entries where they were recorded):');
  for (const d of days) {
    const list = byDate.get(d) ?? [];
    const t = totalsFor(list);
    const macro = (label: string, m: { total: number; recordedCount: number }) =>
      m.recordedCount ? `${label} ${r1(m.total)} g (${m.recordedCount}/${t.entryCount} entries)` : `${label} not recorded`;
    let line = `${d}: ${t.entryCount} entries, ${r0(t.calories)} kcal, ${macro('protein', t.protein)}, ${macro('carbs', t.carbs)}, ${macro('fat', t.fat)}`;
    if (options.includeFoodNames) {
      line += `. Foods: ${list.map((e) => e.name.slice(0, 60)).join('; ')}`;
    }
    lines.push(line);
  }
  return { text: lines.join('\n'), loggedDays: days.length };
}
