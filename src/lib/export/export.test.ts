import { describe, expect, it } from 'vitest';
import { assessmentsToCsv, dailyTotalsToCsv, escapeCsvCell, FOOD_CSV_HEADERS, foodEntriesToCsv, weightsToCsv } from './csv';
import { backupFilename, createBackup, serializeBackup } from './backup';
import { makeAssessment, makeEntry, makeWeight } from '../../test/factories';
import { emptySnapshot } from '../database/snapshot';
import { DEFAULT_PREFERENCES } from '../../app/preferences';

const lines = (csv: string) => csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n');

describe('CSV escaping', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell('plain')).toBe('plain');
  });

  it('neutralises spreadsheet formula prefixes in text', () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvCell('+1')).toBe("'+1");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell('\tcmd')).toBe("'\tcmd");
  });

  it('emits numbers plainly (negative numbers are not prefixed)', () => {
    expect(escapeCsvCell(-600)).toBe('-600');
    expect(escapeCsvCell(12.5)).toBe('12.5');
    expect(escapeCsvCell(Number.NaN)).toBe('');
    expect(escapeCsvCell(null)).toBe('');
  });
});

describe('CSV exports', () => {
  it('writes food entries with headers, units in column names and ISO dates', () => {
    const csv = foodEntriesToCsv([
      makeEntry({ date: '2026-10-09', name: 'Rice, cooked', calories: 205.44, protein: null, meal: 'dinner' }),
      makeEntry({ date: '2026-10-08', name: '=cmd', notes: 'with "quotes"\nand newline' }),
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const rows = lines(csv);
    expect(rows[0]).toBe(FOOD_CSV_HEADERS.join(','));
    expect(rows[0]).toContain('calories_kcal');
    expect(rows[0]).toContain('protein_g');
    // Sorted by date: 2026-10-08 first.
    expect(rows[1]).toMatch(/^2026-10-08,Lunch,'=cmd,/);
    expect(csv).toContain('"with ""quotes""\nand newline"');
    expect(csv).toContain('2026-10-09,Dinner,"Rice, cooked",1,serving,205.4,,');
  });

  it('writes daily totals with recorded-entry counts and omits unlogged days', () => {
    const csv = dailyTotalsToCsv([
      makeEntry({ date: '2026-10-01', calories: 500, protein: 20 }),
      makeEntry({ date: '2026-10-01', calories: 300, protein: null }),
      makeEntry({ date: '2026-10-03', calories: 100 }),
    ]);
    const rows = lines(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatch(/^2026-10-01,2,800,20,1,/);
    expect(rows[2]).toMatch(/^2026-10-03,1,100,/);
  });

  it('writes weights in kg and lb', () => {
    const rows = lines(weightsToCsv([makeWeight({ date: '2026-10-01', weightKg: 80 })]));
    expect(rows[0]).toBe('date,weight_kg,weight_lb,note');
    expect(rows[1]).toBe('2026-10-01,80,176.37,');
  });

  it('writes assessments', () => {
    const rows = lines(assessmentsToCsv([makeAssessment()]));
    expect(rows[1]).toContain('1780');
    expect(rows[1]).toContain('Moderately active');
  });
});

describe('JSON backup', () => {
  it('includes schema version and data, and round-trips through JSON', () => {
    const snap = { ...emptySnapshot(), foodEntries: [makeEntry()], weights: [makeWeight()] };
    const b = createBackup(snap, DEFAULT_PREFERENCES, '1.0.0', new Date('2026-10-10T10:00:00Z'));
    const text = serializeBackup(b);
    const parsed = JSON.parse(text);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.app).toBe('NutriLedger');
    expect(parsed.data.foodEntries).toHaveLength(1);
    expect(parsed).toEqual(JSON.parse(JSON.stringify(b)));
  });

  it('never includes AI keys or the model preference', () => {
    localStorage.setItem('nutriledger.gemini.apiKey', 'AIzaSECRET-KEY-123456');
    const b = createBackup(emptySnapshot(), { ...DEFAULT_PREFERENCES, aiModel: 'x' }, '1.0.0');
    const text = serializeBackup(b);
    expect(text).not.toContain('AIzaSECRET');
    expect(text).not.toMatch(/apiKey|aiModel/i);
  });

  it('builds dated filenames', () => {
    expect(backupFilename('backup', 'json', new Date(2026, 9, 5))).toBe('nutriledger-backup-2026-10-05.json');
  });
});
