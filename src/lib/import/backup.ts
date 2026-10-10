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
import type { Assessment, FoodEntry, Profile, Targets, WeightRecord } from '../../types/models';

/** Backups larger than this are rejected before parsing. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const MAX_RECORDS = 200_000;

const uniqueIds = <T extends { id: string }>(items: T[]) => new Set(items.map((i) => i.id)).size === items.length;

/**
 * Backup schema v1. `z.object` strips unknown keys, so any unexpected field
 * in a file (including anything that looks like a credential) is discarded.
 */
const backupV1Schema = z.object({
  app: z.literal(BACKUP_APP_ID, { error: 'This file is not a NutriLedger backup.' }),
  schemaVersion: z.literal(1),
  exportedAt: isoTimestampSchema,
  appVersion: z.string().max(40).optional().default('unknown'),
  data: z.object({
    foodEntries: z
      .array(foodEntrySchema)
      .max(MAX_RECORDS)
      .refine(uniqueIds, { message: 'The backup contains duplicate food entry IDs.' }),
    assessments: z
      .array(assessmentSchema)
      .max(MAX_RECORDS)
      .refine(uniqueIds, { message: 'The backup contains duplicate assessment IDs.' }),
    weights: z
      .array(weightRecordSchema)
      .max(MAX_RECORDS)
      .refine(uniqueIds, { message: 'The backup contains duplicate weight record IDs.' }),
    profile: profileSchema,
    targets: targetsSchema,
    customMeals: customMealsSchema,
  }),
  preferences: z
    .object({
      theme: z.enum(['system', 'light', 'dark']),
      units: z.enum(['metric', 'imperial']),
    })
    .optional()
    .default({ theme: 'system', units: 'metric' }),
});

export type ParseBackupResult =
  | { ok: true; backup: BackupFile }
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
  const parsed = backupV1Schema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.slice(0, 5).map((i) => {
      const path = i.path.join('.');
      return path ? `${path}: ${i.message}` : i.message;
    });
    return { ok: false, error: 'The backup contains invalid or incomplete data. Nothing was imported.', details };
  }
  return { ok: true, backup: parsed.data as BackupFile };
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
): { plan: ImportPlan; report: ImportReport } {
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
    report.profileChanged = !sameJson(current.profile, d.profile);
    report.targetsChanged = !sameJson(current.targets, d.targets);
    return {
      plan: {
        replace: true,
        foodEntries: d.foodEntries,
        assessments: d.assessments,
        weights: d.weights,
        profile: d.profile,
        targets: d.targets,
        customMeals: d.customMeals,
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
