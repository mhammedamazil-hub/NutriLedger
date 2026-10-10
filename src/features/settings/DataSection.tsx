import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { Notice } from '../../components/feedback/Notice';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { preferencesStore } from '../../app/preferences';
import { keyStore } from '../../lib/ai/keyStore';
import { backupFilename, createBackup, serializeBackup, type BackupFile } from '../../lib/export/backup';
import { assessmentsToCsv, dailyTotalsToCsv, foodEntriesToCsv, weightsToCsv } from '../../lib/export/csv';
import { downloadText } from '../../lib/export/download';
import { parseBackupFile } from '../../lib/import/backup';
import type { DataSnapshot } from '../../lib/database/types';
import { pluralize } from '../../lib/formatting/numbers';
import { ImportDialog } from './ImportDialog';
import styles from './Settings.module.css';

interface StorageInfo {
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

/** Reads storage persistence and usage where the browser supports it. */
async function readStorageInfo(): Promise<StorageInfo> {
  const api = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!api) return { persisted: null, usage: null, quota: null };
  try {
    const [persisted, estimate] = await Promise.all([
      api.persisted ? api.persisted() : Promise.resolve(null),
      api.estimate ? api.estimate() : Promise.resolve(null),
    ]);
    return { persisted, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
  } catch {
    return { persisted: null, usage: null, quota: null };
  }
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

export function DataSection() {
  const store = useDataStore();
  const toast = useToast();
  const status = useData((s) => s.status);
  const counts = useData((s) => `${s.foodEntries.length}|${s.assessments.length}|${s.weights.length}`);
  const [food, assessments, weights] = counts.split('|').map(Number) as [number, number, number];
  const total = food + assessments + weights;
  const [info, setInfo] = useState<StorageInfo>({ persisted: null, usage: null, quota: null });
  const [importState, setImportState] = useState<{ backup: BackupFile; fileName: string; current: DataSnapshot } | null>(null);
  const [importError, setImportError] = useState<{ error: string; details?: string[] | undefined } | null>(null);
  const [reading, setReading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const storageApi = typeof navigator !== 'undefined' ? navigator.storage : undefined;

  const [infoTick, setInfoTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readStorageInfo().then((next) => {
      if (!cancelled) setInfo(next);
    });
    return () => {
      cancelled = true;
    };
  }, [counts, infoTick]);

  const requestPersist = async () => {
    if (!storageApi?.persist) return;
    try {
      const granted = await storageApi.persist();
      toast.show(granted ? 'Persistent storage granted. The browser will not clear this data automatically.' : 'The browser declined persistent storage. Keep regular backups.');
      setInfoTick((t) => t + 1);
    } catch {
      toast.show('Could not request persistent storage.', { tone: 'error' });
    }
  };

  const exportJson = () => {
    const backup = createBackup(store.snapshot(), preferencesStore.get(), __APP_VERSION__);
    downloadText(backupFilename('backup', 'json'), serializeBackup(backup), 'application/json');
    toast.show('Backup downloaded. It contains no API key.');
  };

  const exportCsv = (kind: 'food' | 'daily' | 'weights' | 'assessments') => {
    const snap = store.snapshot();
    const map = {
      food: () => foodEntriesToCsv(snap.foodEntries),
      daily: () => dailyTotalsToCsv(snap.foodEntries),
      weights: () => weightsToCsv(snap.weights),
      assessments: () => assessmentsToCsv(snap.assessments),
    } as const;
    const name = { food: 'food-entries', daily: 'daily-totals', weights: 'weights', assessments: 'assessments' }[kind];
    downloadText(backupFilename(name, 'csv'), map[kind](), 'text/csv;charset=utf-8');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    setReading(true);
    try {
      const r = await parseBackupFile(file);
      if (r.ok) setImportState({ backup: r.backup, fileName: file.name, current: store.snapshot() });
      else setImportError({ error: r.error, details: r.details });
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearAll = async () => {
    await store.clearAll();
    keyStore.clearKey();
    preferencesStore.reset();
    setConfirmClear(false);
    toast.show('All NutriLedger data has been removed from this browser.');
  };

  return (
    <Panel title="Your data" titleId="data" as="section" description="Everything is stored in this browser on this device. There is no cloud copy.">
      <div className="stack">
        {status === 'memory' ? (
          <Notice tone="danger" title="Data is not being saved">
            This browser is not allowing NutriLedger to store data (for example in some private-browsing modes). Anything you
            enter will be lost when the tab closes. Export a backup before leaving.
          </Notice>
        ) : (
          <Notice tone="warning" title="Keep a backup">
            Clearing browser data, uninstalling the browser, or the browser reclaiming space can delete your records. Export a
            backup regularly and keep it somewhere safe.
          </Notice>
        )}

        <dl className={styles.dl}>
          <dt>Stored records</dt>
          <dd>
            {pluralize(food, 'food entry', 'food entries')}, {pluralize(assessments, 'assessment')}, {pluralize(weights, 'weight record')}
          </dd>
          <dt>Storage used</dt>
          <dd>{info.usage !== null ? `${mb(info.usage)}${info.quota ? ` of ${mb(info.quota)} available to this site` : ''}` : 'Not reported by this browser'}</dd>
          <dt>Persistent storage</dt>
          <dd>{info.persisted === null ? 'Not supported by this browser' : info.persisted ? 'Granted' : 'Not granted (browser may clear data under storage pressure)'}</dd>
        </dl>
        {info.persisted === false && storageApi?.persist && (
          <div>
            <Button size="sm" onClick={() => void requestPersist()}>
              Request persistent storage
            </Button>
          </div>
        )}

        <h3 style={{ fontSize: 'var(--text-md)' }}>Export</h3>
        <div className={styles.actions}>
          <Button variant="primary" onClick={exportJson} icon={<Download aria-hidden="true" />}>
            Download full backup (JSON)
          </Button>
        </div>
        <div className={styles.actions}>
          <Button size="sm" onClick={() => exportCsv('food')} disabled={food === 0}>
            Food entries CSV
          </Button>
          <Button size="sm" onClick={() => exportCsv('daily')} disabled={food === 0}>
            Daily totals CSV
          </Button>
          <Button size="sm" onClick={() => exportCsv('weights')} disabled={weights === 0}>
            Weights CSV
          </Button>
          <Button size="sm" onClick={() => exportCsv('assessments')} disabled={assessments === 0}>
            Assessments CSV
          </Button>
        </div>
        <p className="small muted">
          JSON backups can be imported again. CSV files are for spreadsheets; cells that could be interpreted as formulas are
          escaped. Backups never include your API key.
        </p>

        <h3 style={{ fontSize: 'var(--text-md)' }}>Import</h3>
        <div>
          <label htmlFor="import-file" className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 'var(--space-2)' }}>
            <Upload aria-hidden="true" width={16} height={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Choose a NutriLedger backup (.json, up to 20 MB)
          </label>
          <input
            ref={fileRef}
            id="import-file"
            type="file"
            accept=".json,application/json"
            className={styles.fileInput}
            disabled={reading}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
        <p className="small muted">You will see a preview and choose how to merge before anything changes.</p>
        {importError && (
          <Notice tone="danger" title="This file can’t be imported" role="alert">
            {importError.error} Nothing was changed.
            {importError.details && importError.details.length > 0 && (
              <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: '1.2rem' }}>
                {importError.details.slice(0, 5).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </Notice>
        )}

        <h3 style={{ fontSize: 'var(--text-md)' }}>Delete everything</h3>
        <p className="small muted">
          Removes all food entries, assessments, weights, profile, targets, custom meals, preferences and any remembered API key
          from this browser.
        </p>
        <div>
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            Clear all local data
          </Button>
        </div>
      </div>

      {importState && (
        <ImportDialog
          backup={importState.backup}
          fileName={importState.fileName}
          current={importState.current}
          onClose={() => setImportState(null)}
          onDone={(msg) => {
            setImportState(null);
            toast.show(msg);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear all local data?"
        confirmLabel="Delete everything"
        destructive
        requireText="DELETE"
        onCancel={() => setConfirmClear(false)}
        onConfirm={clearAll}
      >
        <p>
          This permanently deletes {pluralize(total, 'record')} and all settings from this browser. There is no cloud copy, so
          this cannot be undone. Download a backup first if you might want this data later.
        </p>
      </ConfirmDialog>
    </Panel>
  );
}
