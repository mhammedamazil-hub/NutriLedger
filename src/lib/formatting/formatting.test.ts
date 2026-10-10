import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isValidDayKey, lastNDays, toDayKey } from './dates';
import { formatSigned, parseNumberInput, pluralize, roundTo, formatWeight, formatHeight } from './numbers';

describe('day keys', () => {
  it('uses the local calendar day, not UTC', () => {
    expect(toDayKey(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31');
  });
  it('validates real dates only', () => {
    expect(isValidDayKey('2026-02-28')).toBe(true);
    expect(isValidDayKey('2028-02-29')).toBe(true);
    expect(isValidDayKey('2026-02-29')).toBe(false);
    expect(isValidDayKey('2026-13-01')).toBe(false);
    expect(isValidDayKey('2026-1-1')).toBe(false);
    expect(isValidDayKey('not a date')).toBe(false);
    expect(isValidDayKey(20261010)).toBe(false);
  });
  it('adds days across month and DST boundaries', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });
  it('lists the last N days oldest first', () => {
    expect(lastNDays('2026-10-02', 3)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });
});

describe('number formatting', () => {
  it('rounds for display only', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2759.4999, 0)).toBe(2759);
  });
  it('formats signed values with a true minus sign', () => {
    expect(formatSigned(-600.4)).toBe('−600');
    expect(formatSigned(200)).toBe('+200');
    expect(formatSigned(0.3)).toBe('0');
  });
  it('pluralises', () => {
    expect(pluralize(1, 'entry', 'entries')).toBe('1 entry');
    expect(pluralize(3, 'entry', 'entries')).toBe('3 entries');
  });
  it('formats weight and height in both unit systems', () => {
    expect(formatWeight(80, 'metric')).toMatch(/^80 kg$/);
    expect(formatWeight(80, 'imperial')).toMatch(/^176\.4 lb$/);
    expect(formatHeight(180, 'imperial')).toMatch(/^5 ft 10\.9 in$/);
  });
  it('parses user number input strictly', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput(' 12.5 ')).toBe(12.5);
    expect(parseNumberInput('12,5')).toBe(12.5);
    expect(parseNumberInput('.5')).toBe(0.5);
    expect(parseNumberInput('abc')).toBeNaN();
    expect(parseNumberInput('12kg')).toBeNaN();
    expect(parseNumberInput('1,000.5')).toBeNaN();
  });
});
