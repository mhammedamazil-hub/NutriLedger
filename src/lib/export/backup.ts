import type { Preferences } from '../../types/models';
import type { DataSnapshot } from '../database/types';

export const BACKUP_APP_ID = 'NutriLedger';
/** Bump when the backup shape changes; add a migration in import/backup.ts. */
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  data: DataSnapshot;
  preferences: Pick<Preferences, 'theme' | 'units'>;
}

/**
 * Builds a backup from an explicit allow-list of fields. Nothing is copied
 * wholesale from app state, so secrets (the Gemini key lives in a separate
 * in-memory/opt-in store) can never leak into a backup.
 */
export function createBackup(
  snapshot: DataSnapshot,
  preferences: Preferences,
  appVersion: string,
  now: Date = new Date(),
): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    appVersion,
    data: {
      foodEntries: snapshot.foodEntries.map((e) => ({ ...e })),
      assessments: snapshot.assessments.map((a) => structuredClone(a)),
      weights: snapshot.weights.map((w) => ({ ...w })),
      profile: { ...snapshot.profile },
      targets: { ...snapshot.targets },
      customMeals: [...snapshot.customMeals],
    },
    preferences: { theme: preferences.theme, units: preferences.units },
  };
}

export const serializeBackup = (b: BackupFile): string => JSON.stringify(b, null, 2);

export function backupFilename(kind: string, ext: 'json' | 'csv', now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `nutriledger-${kind}-${y}-${m}-${d}.${ext}`;
}
