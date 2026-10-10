import { z } from 'zod';
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, type BackupFile } from '../export/backup';
import type { DataSnapshot, ImportPlan } from '../database/types';
import {
  assessmentSchema,
  customMealsSchema,
  foodEntrySchema,
  isoTimestampSchema,
  profileSchema,
  targetsSchema,
  weightRecordSchema,
} from '../validation/schemas';
import { EMPTY_PROFILE, EMPTY_TARGETS, type Assessment, type FoodEntry, type Profile, type Targets, type WeightRecord } from '../../types/models';

/** Backups larger than this are rejected before parsing. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const MAX_RECORDS = 200_000;

/**
 * Envelope of backup schema v1. The structure is validated strictly, while
 * individual records are validated one by one (see `parseBackupText`) so a
 * single damaged record does not block restoring every other valid record.
 * `z.object` strips unknown keys, so any unexpected field (including anything
 * that looks like a credential) is discarded.
 */
const envelopeV1Schema = z.object({
  app: z.literal(BACKUP_APP_ID, { error: 'This file is not a NutriLedger backup.' }),
  schemaVersion: z.literal(1),
  exportedAt: isoTimestampSchema,
  appVersion: z.string().max(40).optional().default('unknown'),
  data: z.object({
    foodEntries: z.array(z.unknown()).max(MAX_RECORDS),
    assessments: z.array(z.unknown()).max(MAX_RECORDS),
    weights: z.array(z.unknown()).max(MAX_RECORDS),
    profile: z.unknown(),
    targets: z.unknown(),
    customMeals: z.unknown(),
  }),
  preferences: z
    .object({
      theme: z.enum(['system', 'light', 'dark']),
      units: z.enum(['metric', 'imperial']),
    })
    .optional()
    .catch(undefined)
    .transform((p) => p ?? { theme: 'system' as const, units: 'metric' as const }),
});

/** A record in the file that failed validation and will not be imported. */
export interface RejectedItem {
  /** Human-readable collection, e.g. "Food entry". */
  kind: string;
  /** 1-based position in the file's list, or null for single settings objects. */
  position: number | null;
  /** The record's ID if it had a readable one. */
  id: string | null;
  reason: string;
}

function issueText(error: z.ZodError): string {
  return error.issues
    .slice(0, 2)
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ');
}

function readId(raw: unknown): string | null {
  if (raw && typeof raw === 'object' && 'id' in raw) {
    const id = (raw as { id: unknown }).id;
    if (typeof id === 'string' && id.length <= 64) return id;
  }
  return null;
}

function validateList<T extends { id: string }>(
  raw: readonly unknown[],
  schema: z.ZodType<T>,
  kind: string,
  rejected: RejectedItem[],
): T[] {
  const valid: Array<{ item: T; position: number }> = [];
  raw.forEach((r, i) => {
    const parsed = schema.safeParse(r);
    if (parsed.success) valid.push({ item: parsed.data, position: i + 1 });
    else rejected.push({ kind, position: i + 1, id: readId(r), reason: issueText(parsed.error) });
  });
  // Duplicate IDs inside one file are ambiguous (which copy is right?), so every copy is rejected.
  const counts = new Map<string, number>();
  for (const v of valid) counts.set(v.item.id, (counts.get(v.item.id) ?? 0) + 1);
  const out: T[] = [];
  for (const v of valid) {
    if ((counts.get(v.item.id) ?? 0) > 1) {
      rejected.push({ kind, position: v.position, id: v.item.id, reason: 'The same ID appears more than once in this file.' });
    } else {
      out.push(v.item);
    }
  }
  return out;
}

export type ParseBackupResult =
  | { ok: true; backup: BackupFile; rejected: RejectedItem[] }
  | { ok: false; error: string; details?: string[] };

/** Parses and validates backup text. Never mutates anything. */
export function parseBackupText(text: string): ParseBackupResult {
  if (text.length > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'This file is too large to be a NutriLedger backup (limit 20 MB).' };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON. It may be damaged or not a backup.' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'This file is not a NutriLedger backup.' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'This file is not a NutriLedger backup.' };
  }
  const version = obj.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, error: 'The backup has no valid schema version.' };
  }
  if (version > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This backup was created by a newer version of NutriLedger (schema ${version}). Update the app, then try again.`,
    };
  }
  if (version < 1) {
    return { ok: false, error: `Backup schema version ${version} is not supported.` };
  }
  // Future: migrate older schema versions to the current shape here, step by step.
  const env = envelopeV1Schema.safeParse(raw);
  if (!env.success) {
    const details = env.error.issues.slice(0, 5).map((i) => {
      const path = i.path.join('.');
      return path ? `${path}: ${i.message}` : i.message;
    });
    return { ok: false, error: 'The backup is damaged or incomplete. Nothing was imported.', details };
  }
  const d = env.data.data;
  const rejected: RejectedItem[] = [];
  const foodEntries = validateList<FoodEntry>(d.foodEntries, foodEntrySchema, 'Food entry', rejected);
  const assessments = validateList<Assessment>(d.assessments, assessmentSchema, 'Assessment', rejected);
  const weights = validateList<WeightRecord>(d.weights, weightRecordSchema, 'Weight record', rejected);

  const single = <T,>(value: unknown, schema: z.ZodType<T>, kind: string, fallback: T): T => {
    const r = schema.safeParse(value);
    if (r.success) return r.data;
    rejected.push({ kind, position: null, id: null, reason: issueText(r.error) });
    return fallback;
  };
  const profile = single<Profile>(d.profile, profileSchema, 'Profile', { ...EMPTY_PROFILE });
  const targets = single<Targets>(d.targets, targetsSchema, 'Targets', { ...EMPTY_TARGETS });
  const customMeals = single<string[]>(d.customMeals, customMealsSchema, 'Custom meals', []);

  const backup: BackupFile = {
    app: BACKUP_APP_ID,
    schemaVersion: 1,
    exportedAt: env.data.exportedAt,
    appVersion: env.data.appVersion,
    data: { foodEntries, assessments, weights, profile, targets, customMeals },
    preferences: env.data.preferences,
  };
  return { ok: true, backup, rejected };
}

/** Reads a File with type and size checks, then validates it. */
export async function parseBackupFile(file: File): Promise<ParseBackupResult> {
  const nameOk = /\.json$/i.test(file.name);
  const typeOk = file.type === '' || /json|text\/plain/i.test(file.type);
  if (!nameOk || !typeOk) {
    return { ok: false, error: 'Choose a .json backup file exported from NutriLedger.' };
  }
  if (file.size > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'This file is too large to be a NutriLedger backup (limit 20 MB).' };
  }
  if (file.size === 0) return { ok: false, error: 'The file is empty.' };
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'The file could not be read.' };
  }
  return parseBackupText(text);
}

export type ImportMode = 'merge' | 'replace';
/** What to do when a backup record has the same ID as an existing record but different content. */
export type ConflictPolicy = 'keep-existing' | 'use-backup';

export interface ImportReport {
  added: number;
  updated: number;
  unchanged: number;
  conflictsKept: number;
  profileChanged: boolean;
  targetsChanged: boolean;
}

/** Key-order-independent JSON for equality checks (validated objects may reorder keys). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const sameJson = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

function isEmptyProfile(p: Profile): boolean {
  return p.age === null && p.sex === null && p.heightCm === null && p.weightKg === null && p.activity === null;
}
function isEmptyTargets(t: Targets): boolean {
  return t.calories === null && t.protein === null && t.carbs === null && t.fat === null;
}

/**
 * Builds an import plan and a human-readable report. Pure: does not touch storage.
 * - replace: the backup becomes the whole dataset.
 * - merge: new IDs are added; identical records are skipped; ID collisions
 *   with different content follow `conflict`.
 */
export function planImport(
  current: DataSnapshot,
  backup: BackupFile,
  mode: ImportMode,
  conflict: ConflictPolicy,
  rejected: readonly RejectedItem[] = [],
): { plan: ImportPlan; report: ImportReport } {
  // Settings objects that failed validation are never applied; the current ones are kept.
  const rejectedKinds = new Set(rejected.filter((r) => r.position === null).map((r) => r.kind));
  const report: ImportReport = {
    added: 0,
    updated: 0,
    unchanged: 0,
    conflictsKept: 0,
    profileChanged: false,
    targetsChanged: false,
  };
  const d = backup.data;

  if (mode === 'replace') {
    report.added = d.foodEntries.length + d.assessments.length + d.weights.length;
    const profile = rejectedKinds.has('Profile') ? current.profile : d.profile;
    const targets = rejectedKinds.has('Targets') ? current.targets : d.targets;
    const customMeals = rejectedKinds.has('Custom meals') ? current.customMeals : d.customMeals;
    report.profileChanged = !sameJson(current.profile, profile);
    report.targetsChanged = !sameJson(current.targets, targets);
    return {
      plan: {
        replace: true,
        foodEntries: d.foodEntries,
        assessments: d.assessments,
        weights: d.weights,
        profile,
        targets,
        customMeals,
      },
      report,
    };
  }

  function mergeList<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
    const byId = new Map(existing.map((e) => [e.id, e]));
    const writes: T[] = [];
    for (const item of incoming) {
      const prev = byId.get(item.id);
      if (!prev) {
        writes.push(item);
        report.added += 1;
      } else if (sameJson(prev, item)) {
        report.unchanged += 1;
      } else if (conflict === 'use-backup') {
        writes.push(item);
        report.updated += 1;
      } else {
        report.conflictsKept += 1;
      }
    }
    return writes;
  }

  const foodEntries = mergeList<FoodEntry>(current.foodEntries, d.foodEntries);
  const assessments = mergeList<Assessment>(current.assessments, d.assessments);
  const weights = mergeList<WeightRecord>(current.weights, d.weights);

  let profile: Profile | null = null;
  if (!sameJson(current.profile, d.profile) && !isEmptyProfile(d.profile)) {
    if (isEmptyProfile(current.profile) || conflict === 'use-backup') profile = d.profile;
  }
  let targets: Targets | null = null;
  if (!sameJson(current.targets, d.targets) && !isEmptyTargets(d.targets)) {
    if (isEmptyTargets(current.targets) || conflict === 'use-backup') targets = d.targets;
  }
  report.profileChanged = profile !== null;
  report.targetsChanged = targets !== null;

  const mergedMeals = [...current.customMeals];
  for (const m of d.customMeals) {
    if (!mergedMeals.some((x) => x.toLowerCase() === m.toLowerCase()) && mergedMeals.length < 12) {
      mergedMeals.push(m);
    }
  }
  const customMeals = sameJson(mergedMeals, current.customMeals) ? null : mergedMeals;

  return {
    plan: { replace: false, foodEntries, assessments, weights, profile, targets, customMeals },
    report,
  };
}
