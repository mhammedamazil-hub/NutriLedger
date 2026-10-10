import { useState } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { Notice } from '../../components/feedback/Notice';
import { EmptyState } from '../../components/feedback/EmptyState';
import { TextAreaField, TextField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { usePreferences } from '../../app/preferences';
import { useProfileEstimate } from '../../hooks/useDerived';
import { useTodayKey } from '../../hooks/useTodayKey';
import { ACTIVITY_INFO } from '../../lib/calculations/energy';
import { formatInt, formatOne, formatWeight } from '../../lib/formatting/numbers';
import { isValidDayKey } from '../../lib/formatting/dates';
import { BOUNDS } from '../../lib/validation/bounds';
import type { AssessmentInputs, AssessmentResults } from '../../types/models';
import styles from './Calculator.module.css';

const n2 = (n: number) => formatOne(n);

export function FormulaBreakdown({ inputs, results }: { inputs: AssessmentInputs; results: AssessmentResults }) {
  const { age, sex, heightCm, weightKg, neckCm, waistCm, hipCm } = inputs;
  const constant = sex === 'male' ? '+ 5' : '− 161';
  return (
    <dl className={styles.formulaList}>
      <div>
        <dt>BMR — Mifflin–St Jeor ({sex})</dt>
        <dd>
          <code className={styles.formula}>
            10 × {n2(weightKg)} kg + 6.25 × {n2(heightCm)} cm − 5 × {age} y {constant} = {formatInt(results.bmr)} kcal/day
          </code>
        </dd>
      </div>
      <div>
        <dt>TDEE — BMR × activity multiplier</dt>
        <dd>
          <code className={styles.formula}>
            {formatInt(results.bmr)} × {results.activityMultiplier} ({ACTIVITY_INFO[inputs.activity].label.toLowerCase()}) ={' '}
            {formatInt(results.tdee)} kcal/day
          </code>
        </dd>
      </div>
      {results.bodyFatPercent !== null && waistCm !== null && neckCm !== null && (
        <div>
          <dt>Body fat — US Navy circumference method ({sex})</dt>
          <dd>
            <code className={styles.formula}>
              {sex === 'male'
                ? `495 ÷ (1.0324 − 0.19077 × log10(${n2(waistCm)} − ${n2(neckCm)}) + 0.15456 × log10(${n2(heightCm)})) − 450`
                : `495 ÷ (1.29579 − 0.35004 × log10(${n2(waistCm)} + ${n2(hipCm ?? 0)} − ${n2(neckCm)}) + 0.221 × log10(${n2(heightCm)})) − 450`}{' '}
              = {n2(results.bodyFatPercent)}%
            </code>
          </dd>
        </div>
      )}
      {results.leanMassKg !== null && results.bodyFatPercent !== null && (
        <div>
          <dt>Lean body mass</dt>
          <dd>
            <code className={styles.formula}>
              {n2(weightKg)} kg × (1 − {n2(results.bodyFatPercent)} ÷ 100) = {n2(results.leanMassKg)} kg
            </code>
          </dd>
        </div>
      )}
      {results.katchMcArdleBmr !== null && results.leanMassKg !== null && (
        <div>
          <dt>BMR — Katch–McArdle</dt>
          <dd>
            <code className={styles.formula}>
              370 + 21.6 × {n2(results.leanMassKg)} kg = {formatInt(results.katchMcArdleBmr)} kcal/day
            </code>
          </dd>
        </div>
      )}
    </dl>
  );
}

export function ResultsPanel() {
  const estimate = useProfileEstimate();
  const store = useDataStore();
  const toast = useToast();
  const targets = useData((s) => s.targets);
  const { units } = usePreferences();
  const today = useTodayKey();
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'save' | 'target' | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  if (estimate.status === 'incomplete') {
    return (
      <Panel title="Results" titleId="results-title">
        <EmptyState compact title="No estimate yet">
          Fill in age, equation variant, height, weight and activity level, then choose “Calculate and save profile”.
        </EmptyState>
      </Panel>
    );
  }

  if (estimate.status === 'unavailable') {
    const minor = estimate.inputs.age < 18;
    return (
      <Panel title="Results" titleId="results-title">
        {minor ? (
          <Notice tone="info" title="Estimates are not shown for people under 18">
            Energy needs during growth differ from adults, and the adult equations and calorie targets used here are not
            appropriate. NutriLedger will not suggest a calorie target or deficit. For guidance, please talk with a doctor,
            school nurse or registered dietitian. You can still use the food diary to record meals.
          </Notice>
        ) : (
          <Notice tone="warning" title="Estimate not available">
            {estimate.reason}
          </Notice>
        )}
      </Panel>
    );
  }

  const { inputs } = estimate;
  const { results, bodyFatIssue } = estimate.estimate;
  const tdeeRounded = Math.round(results.tdee);
  const targetMatches = targets.calories === tdeeRounded && targets.calorieSource === 'tdee-estimate';
  const canUseAsTarget = tdeeRounded >= BOUNDS.targetCalories.min && tdeeRounded <= BOUNDS.targetCalories.max;

  const saveAssessment = async () => {
    if (busy) return;
    if (!isValidDayKey(date)) {
      setDateError('Choose a valid date.');
      return;
    }
    setBusy('save');
    try {
      await store.saveAssessment({ date, inputs, results, notes: notes.trim() });
      setNotes('');
      toast.show('Assessment saved to history.');
    } catch {
      toast.show('The assessment could not be saved.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const applyTdeeTarget = async () => {
    if (busy) return;
    setBusy('target');
    const previous = targets;
    const { updatedAt: _ignored, ...rest } = targets;
    void _ignored;
    try {
      await store.saveTargets({ ...rest, calories: tdeeRounded, calorieSource: 'tdee-estimate' });
      toast.show(`Daily calorie target set to ${formatInt(tdeeRounded)} kcal.`, {
        durationMs: 8000,
        action: {
          label: 'Undo',
          onClick: () => {
            const { updatedAt: _u, ...prev } = previous;
            void _u;
            store.saveTargets(prev).catch(() => toast.show('Could not restore the previous target.', { tone: 'error' }));
          },
        },
      });
    } catch {
      toast.show('The target could not be saved.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Results"
      titleId="results-title"
      description={`Estimates for ${inputs.age} y · ${formatWeight(inputs.weightKg, units)} · ${ACTIVITY_INFO[inputs.activity].label.toLowerCase()}.`}
    >
      <div className="stack">
        <div className={styles.resultGrid}>
          <div className={styles.result}>
            <span className={styles.resultLabel}>BMR (Mifflin–St Jeor)</span>
            <span className={styles.resultValue}>{formatInt(results.bmr)}</span>
            <span className="small muted">kcal/day at rest</span>
          </div>
          <div className={`${styles.result} ${styles.resultPrimary}`}>
            <span className={styles.resultLabel}>Estimated TDEE</span>
            <span className={styles.resultValue}>{formatInt(results.tdee)}</span>
            <span className="small muted">kcal/day incl. activity</span>
          </div>
          {results.bodyFatPercent !== null && (
            <div className={styles.result}>
              <span className={styles.resultLabel}>Body fat (US Navy)</span>
              <span className={styles.resultValue}>{formatOne(results.bodyFatPercent)}%</span>
              <span className="small muted">
                lean mass {formatWeight(results.leanMassKg ?? 0, units)}
              </span>
            </div>
          )}
          {results.katchMcArdleBmr !== null && results.katchMcArdleTdee !== null && (
            <div className={styles.result}>
              <span className={styles.resultLabel}>Katch–McArdle</span>
              <span className={styles.resultValue}>{formatInt(results.katchMcArdleBmr)}</span>
              <span className="small muted">BMR · TDEE {formatInt(results.katchMcArdleTdee)}</span>
            </div>
          )}
        </div>

        {bodyFatIssue && (
          <Notice tone="warning" title="Body-fat estimate not calculated">
            {bodyFatIssue}
          </Notice>
        )}

        <p className="small muted">
          These are population-level equations with a typical error of around ±10% for individuals. They are a starting
          point for planning, not a medical assessment. Weight trends over several weeks are a better guide than any single
          estimate.
        </p>

        <details className={styles.details}>
          <summary>Show the arithmetic</summary>
          <FormulaBreakdown inputs={inputs} results={results} />
          <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
            Calculated in metric units. <Link to="/ai?tool=explain">Ask AI to explain these numbers</Link> (optional; uses
            your Gemini key).
          </p>
        </details>

        <div className={styles.actions}>
          {canUseAsTarget && (
            <Button onClick={() => void applyTdeeTarget()} loading={busy === 'target'} disabled={targetMatches}>
              {targetMatches ? 'TDEE is your daily target' : 'Use TDEE as daily calorie target'}
            </Button>
          )}
        </div>
        {targets.calories !== null && !targetMatches && (
          <p className="small muted">Your current target is {formatInt(targets.calories)} kcal. You can also edit targets in Settings.</p>
        )}

        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend style={{ fontWeight: 650, marginBottom: 'var(--space-2)', padding: 0 }}>Save to history</legend>
          <p className="small muted">Saving creates a new record; earlier assessments are kept.</p>
          <TextField
            label="Assessment date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              setDate(e.target.value);
              setDateError(null);
            }}
            error={dateError ?? undefined}
          />
          <TextAreaField label="Notes" optional rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div>
            <Button variant="primary" onClick={() => void saveAssessment()} loading={busy === 'save'}>
              Save assessment
            </Button>
          </div>
        </fieldset>
      </div>
    </Panel>
  );
}
