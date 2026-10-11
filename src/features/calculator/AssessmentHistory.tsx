import { useMemo, useState } from 'react';
import { Button } from '../../components/common/Button';
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
    <section className={styles.ledger} aria-labelledby="history-title">
      <div className={styles.ledgerHead}>
        <h2 id="history-title" className={styles.ledgerTitle}>
          Assessment history
        </h2>
        <p className={styles.sectionLede}>Saved snapshots of your inputs and results. Progress charts use these records.</p>
      </div>
      {sorted.length === 0 ? (
        <div className={styles.ledgerEmpty}>
          <p className={styles.emptyTitle}>No saved assessments</p>
          <p className={styles.helper}>After calculating, use “Save assessment” to keep a dated record.</p>
        </div>
      ) : (
        <ul className={styles.ledgerList}>
          {sorted.map((a) => (
            <li key={a.id} className={styles.ledgerRow}>
              <span className={styles.ledgerDate}>{formatDayMedium(a.date)}</span>
              <span className={styles.ledgerFigure}>
                <span className={styles.ledgerNum}>{formatInt(a.results.tdee)}</span>
                <span className={styles.ledgerUnit}>TDEE kcal</span>
              </span>
              <span className={styles.ledgerFigure}>
                <span className={styles.ledgerNum}>{formatInt(a.results.bmr)}</span>
                <span className={styles.ledgerUnit}>BMR kcal</span>
              </span>
              <div className={styles.ledgerDetail}>
                <span>
                  {formatWeight(a.inputs.weightKg, units)} · {formatHeight(a.inputs.heightCm, units)} · {a.inputs.age} y ·{' '}
                  {ACTIVITY_INFO[a.inputs.activity].label.toLowerCase()}
                  {a.results.bodyFatPercent !== null && ` · body fat ${formatOne(a.results.bodyFatPercent)}%`}
                </span>
                {a.notes && <span>Note: {a.notes}</span>}
                <details className={styles.ledgerMath}>
                  <summary>Arithmetic</summary>
                  <FormulaBreakdown inputs={a.inputs} results={a.results} />
                </details>
              </div>
              <Button
                variant="ghost"
                className={styles.ledgerDelete}
                aria-label={`Delete assessment from ${formatDayMedium(a.date)}`}
                onClick={() => setPending(a)}
              >
                Delete
              </Button>
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
    </section>
  );
}
