import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { usePreferences } from '../../app/preferences';
import { ACTIVITY_INFO } from '../../lib/calculations/energy';
import { formatDayMedium } from '../../lib/formatting/dates';
import { formatHeight, formatInt, formatOne, formatWeight } from '../../lib/formatting/numbers';
import type { Assessment } from '../../types/models';
import { FormulaBreakdown } from './ResultsPanel';
import styles from './Calculator.module.css';

export function AssessmentHistory() {
  const assessments = useData((s) => s.assessments);
  const { units } = usePreferences();
  const store = useDataStore();
  const toast = useToast();
  const [pending, setPending] = useState<Assessment | null>(null);
  const sorted = useMemo(
    () => [...assessments].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [assessments],
  );

  return (
    <Panel title="Assessment history" titleId="history-title" description="Saved snapshots of your inputs and results.">
      {sorted.length === 0 ? (
        <EmptyState compact title="No saved assessments">
          After calculating, use “Save assessment” to keep a dated record. Progress charts use these records.
        </EmptyState>
      ) : (
        <ul className={styles.history}>
          {sorted.map((a) => (
            <li key={a.id} className={styles.historyItem}>
              <div className="stack-sm" style={{ minWidth: 0 }}>
                <span className={styles.historyTitle}>{formatDayMedium(a.date)}</span>
                <span className={styles.historyMeta}>
                  BMR {formatInt(a.results.bmr)} · TDEE {formatInt(a.results.tdee)} kcal
                  {a.results.bodyFatPercent !== null && ` · body fat ${formatOne(a.results.bodyFatPercent)}%`}
                </span>
                <span className={styles.historyMeta}>
                  {formatWeight(a.inputs.weightKg, units)} · {formatHeight(a.inputs.heightCm, units)} · {a.inputs.age} y ·{' '}
                  {ACTIVITY_INFO[a.inputs.activity].label.toLowerCase()}
                </span>
                {a.notes && <span className={styles.historyMeta}>Note: {a.notes}</span>}
                <details>
                  <summary className="small" style={{ cursor: 'pointer', color: 'var(--c-primary)', fontWeight: 600 }}>
                    Arithmetic
                  </summary>
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <FormulaBreakdown inputs={a.inputs} results={a.results} />
                  </div>
                </details>
              </div>
              <Button
                iconOnly
                variant="ghost"
                size="sm"
                aria-label={`Delete assessment from ${formatDayMedium(a.date)}`}
                onClick={() => setPending(a)}
                icon={<Trash2 aria-hidden="true" />}
              />
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pending !== null}
        title="Delete this assessment?"
        confirmLabel="Delete assessment"
        destructive
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          await store.deleteAssessment(pending.id);
          toast.show('Assessment deleted.');
          setPending(null);
        }}
      >
        <p>
          The assessment from {pending ? formatDayMedium(pending.date) : ''} will be permanently removed. Your current profile
          is not affected.
        </p>
      </ConfirmDialog>
    </Panel>
  );
}
