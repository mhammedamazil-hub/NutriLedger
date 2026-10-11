import type { UnitSystem } from '../../types/models';
import { cmToFeetInches, cmToIn, kgToLb } from '../calculations/units';

const intFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const oneFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

/** Rounds for display only; stored values keep full precision. */
export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export const formatInt = (n: number): string => intFmt.format(Math.round(n));
export const formatOne = (n: number): string => oneFmt.format(roundTo(n, 1));

export const formatKcal = (n: number): string => `${formatInt(n)} kcal`;
export const formatGrams = (n: number): string => `${formatOne(n)} g`;

/** Signed number with an explicit + or − (true minus sign). */
export function formatSigned(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '0';
  return r > 0 ? `+${intFmt.format(r)}` : `−${intFmt.format(Math.abs(r))}`;
}

export function formatWeight(kg: number, units: UnitSystem): string {
  return units === 'imperial' ? `${formatOne(kgToLb(kg))} lb` : `${formatOne(kg)} kg`;
}

export function formatHeight(cm: number, units: UnitSystem): string {
  if (units === 'metric') return `${formatOne(cm)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet} ft ${formatOne(inches)} in`;
}

export function formatLength(cm: number, units: UnitSystem): string {
  return units === 'imperial' ? `${formatOne(cmToIn(cm))} in` : `${formatOne(cm)} cm`;
}

export const weightUnit = (u: UnitSystem): 'kg' | 'lb' => (u === 'imperial' ? 'lb' : 'kg');
export const lengthUnit = (u: UnitSystem): 'cm' | 'in' => (u === 'imperial' ? 'in' : 'cm');

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatInt(count)} ${count === 1 ? singular : plural}`;
}

/**
 * Parses user-typed numbers. Accepts "1,5" as a decimal comma only when there
 * is no dot. Returns null for empty input and NaN for anything unparseable.
 */
export function parseNumberInput(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  const normalised = !s.includes('.') && /^\s*-?\d+,\d+\s*$/.test(s) ? s.replace(',', '.') : s;
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(normalised)) return Number.NaN;
  return Number(normalised);
}
