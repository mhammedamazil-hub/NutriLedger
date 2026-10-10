import { useMemo, useState } from 'react';
import { Dialog } from '../../components/dialogs/Dialog';
import { Button } from '../../components/common/Button';
import { Checkbox, Segmented } from '../../components/forms/Field';
import { Notice } from '../../components/feedback/Notice';
import { useDataStore } from '../../app/dataContext';
import { preferencesStore } from '../../app/preferences';
import type { BackupFile } from '../../lib/export/backup';
import { planImport, type ConflictPolicy, type ImportMode } from '../../lib/import/backup';
import { formatInt, pluralize } from '../../lib/formatting/numbers';
import type { DataSnapshot } from '../../lib/database/types';
import styles from './Settings.module.css';

interface Props {
  backup: BackupFile;
  fileName: string;
  current: DataSnapshot;
  onClose: () => void;
  onDone: (message: string) => void;
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Preview + confirm step. Nothing is written until the user confirms; the write is a single atomic transaction. */
export function ImportDialog({ backup, fileName, current, onClose, onDone }: Props) {
  const store = useDataStore();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [conflict, setConflict] = useState<ConflictPolicy>('keep-existing');
  const [applyPrefs, setApplyPrefs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { plan, report } = useMemo(() => planImport(current, backup, mode, conflict), [current, backup, mode, conflict]);
  const d = backup.data;
  const currentCount = current.foodEntries.length + current.assessments.length + current.weights.length;
  const exported = new Date(backup.exportedAt);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await store.applyImport(plan);
      if (applyPrefs) preferencesStore.update({ theme: backup.preferences.theme, units: backup.preferences.units });
      onDone(
        mode === 'replace'
          ? `Backup restored: ${pluralize(report.added, 'record')} now on this device.`
          : `Import complete: ${report.added} added, ${report.updated} updated, ${report.unchanged + report.conflictsKept} unchanged.`,
      );
    } catch {
      setError('The import failed and was rolled back. Your existing data has not been changed.');
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      wide
      title="Import backup"
      onClose={onClose}
      canClose={() => !busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={mode === 'replace' ? 'danger' : 'primary'} onClick={() => void confirm()} loading={busy}>
            {mode === 'replace' ? 'Replace my data' : 'Import'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="small">
          <strong>{fileName}</strong> · exported {Number.isNaN(exported.getTime()) ? 'at an unknown time' : dateTime.format(exported)} · app
          version {backup.appVersion || 'unknown'}
        </p>
        <table className={styles.previewTable}>
          <caption className="visually-hidden">Records in this backup compared with this device</caption>
          <thead>
            <tr>
              <th scope="col">Record type</th>
              <th scope="col">In backup</th>
              <th scope="col">On this device</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Food entries</td>
              <td>{formatInt(d.foodEntries.length)}</td>
              <td>{formatInt(current.foodEntries.length)}</td>
            </tr>
            <tr>
              <td>Assessments</td>
              <td>{formatInt(d.assessments.length)}</td>
              <td>{formatInt(current.assessments.length)}</td>
            </tr>
            <tr>
              <td>Weight records</td>
              <td>{formatInt(d.weights.length)}</td>
              <td>{formatInt(current.weights.length)}</td>
            </tr>
            <tr>
              <td>Custom meals</td>
              <td>{d.customMeals.length}</td>
              <td>{current.customMeals.length}</td>
            </tr>
          </tbody>
        </table>

        <Segmented<ImportMode>
          legend="How to import"
          name="import-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'merge', label: 'Merge with my data' },
            { value: 'replace', label: 'Replace all my data' },
          ]}
        />

        {mode === 'merge' ? (
          <>
            <Segmented<ConflictPolicy>
              legend="If a record exists in both with different content"
              name="conflict"
              value={conflict}
              onChange={setConflict}
              options={[
                { value: 'keep-existing', label: 'Keep mine' },
                { value: 'use-backup', label: 'Use backup' },
              ]}
            />
            <Notice tone="info" title="What will happen" role="status">
              {report.added} new {report.added === 1 ? 'record' : 'records'} added
              {report.updated > 0 && `, ${report.updated} replaced by the backup version`}
              {report.unchanged > 0 && `, ${report.unchanged} identical skipped`}
              {report.conflictsKept > 0 && `, ${report.conflictsKept} conflicting kept as they are`}.
              {report.profileChanged && ' Your profile will be updated from the backup.'}
              {report.targetsChanged && ' Your targets will be updated from the backup.'}
            </Notice>
          </>
        ) : (
          <Notice tone="warning" title="Your current data will be replaced" role="status">
            All {pluralize(currentCount, 'record')} currently on this device, plus your profile, targets and custom meals, will be
            replaced by the backup. This cannot be undone. Consider exporting a backup of your current data first.
          </Notice>
        )}

        <Checkbox checked={applyPrefs} onChange={setApplyPrefs}>
          Also apply the backup’s theme ({backup.preferences.theme}) and units ({backup.preferences.units})
        </Checkbox>

        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}
