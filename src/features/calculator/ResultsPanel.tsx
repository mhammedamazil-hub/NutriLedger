import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/common/Button';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { usePreferences } from '../../app/preferences';
import { useProfileEstimate } from '../../hooks/useDerived';
import { useTodayKey } from '../../hooks/useTodayKey';
import { ACTIVITY_INFO } from '../../lib/calculations/energy';
import { formatInt, formatOne, formatWeight } from '../../lib/formatting/numbers';
import { BOUNDS } from '../../lib/validation/bounds';
import type { AssessmentInputs, AssessmentResults } from '../../types/models';
import styles from './Calculator.module.css';
import { saveErrorMessage } from '../../lib/database/errors';
import { validateAssessmentDate } from './calculatorForm';
import { MeasureField, NotesField } from './CalcControls';
import { ActivitySpectrum, EnergyComposition, GhostCharts, RangeScale } from './ReadoutCharts';

/** Shared frame: the readout keeps the `results-title` landmark name in every state. */
function Readout({ state, meta, children }: { state: 'ready' | 'empty'; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={styles.readout} aria-labelledby="results-title" data-state={state}>
      <div className={styles.readoutHead}>
        <h2 id="results-title" className={styles.eyebrow}>
          Results
        </h2>
        {meta && <p className={styles.readoutFor}>{meta}</p>}
      </div>
      {children}
    </section>
  );
}

function GhostHero() {
  return (
    <div className={styles.hero} aria-hidden="true">
      <span className={styles.heroLabel}>Estimated TDEE · kcal/day</span>
      <span className={`${styles.heroValue} ${styles.heroGhost}`}>—</span>
    </div>
  );
}

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
      <Readout state="empty">
        <GhostHero />
        <div className={styles.emptyCopy}>
          <p className={styles.emptyTitle}>No estimate yet</p>
          <p className={styles.helper}>
            Fill in age, equation variant, height, weight and activity level, then choose “Calculate”. The figure and its
            breakdown appear here, calculated on this device.
          </p>
        </div>
        <GhostCharts />
      </Readout>
    );
  }

  if (estimate.status === 'unavailable') {
    const minor = estimate.inputs.age < 18;
    return (
      <Readout state="empty">
        <GhostHero />
        {minor ? (
          <div className={styles.callout} data-tone="info">
            <p className={styles.calloutTitle}>Estimates are not shown for people under 18</p>
            <p>
              Energy needs during growth differ from adults, and the adult equations and calorie targets used here are not
              appropriate. NutriLedger will not suggest a calorie target or deficit. For guidance, please talk with a
              doctor, school nurse or registered dietitian. You can still use the food diary to record meals.
            </p>
          </div>
        ) : (
          <div className={styles.callout} data-tone="warning">
            <p className={styles.calloutTitle}>Estimate not available</p>
            <p>{estimate.reason}</p>
          </div>
        )}
      </Readout>
    );
  }

  const { inputs } = estimate;
  const { results, bodyFatIssue } = estimate.estimate;
  const tdeeRounded = Math.round(results.tdee);
  const targetMatches = targets.calories === tdeeRounded && targets.calorieSource === 'tdee-estimate';
  const canUseAsTarget = tdeeRounded >= BOUNDS.targetCalories.min && tdeeRounded <= BOUNDS.targetCalories.max;

  const saveAssessment = async () => {
    if (busy) return;
    const dateProblem = validateAssessmentDate(date, today);
    if (dateProblem) {
      setDateError(dateProblem);
      return;
    }
    setBusy('save');
    try {
      await store.saveAssessment({ date, inputs, results, notes: notes.trim() });
      setNotes('');
      toast.show('Assessment saved to history.');
    } catch (err) {
      toast.show(saveErrorMessage(err, 'The assessment could not be saved.'), { tone: 'error', durationMs: 10000 });
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
    } catch (err) {
      toast.show(saveErrorMessage(err, 'The target could not be saved.'), { tone: 'error', durationMs: 10000 });
    } finally {
      setBusy(null);
    }
  };

  const showTarget = targets.calories !== null && !targetMatches ? targets.calories : null;
  const hasMetrics = results.bodyFatPercent !== null || results.katchMcArdleBmr !== null;

  return (
    <Readout
      state="ready"
      meta={`${inputs.age} y · ${formatWeight(inputs.weightKg, units)} · ${ACTIVITY_INFO[inputs.activity].label.toLowerCase()} · Mifflin–St Jeor`}
    >
      <div className={styles.hero}>
        <span className={styles.heroLabel}>Estimated TDEE · kcal/day</span>
        <span className={styles.heroValue}>{formatInt(results.tdee)}</span>
        <span className={styles.heroUnit}>Total daily energy expenditure, including activity</span>
      </div>

      <RangeScale tdee={results.tdee} target={showTarget} />
      <EnergyComposition bmr={results.bmr} tdee={results.tdee} />
      <ActivitySpectrum bmr={results.bmr} current={inputs.activity} />

      {hasMetrics && (
        <dl className={styles.metrics}>
          {results.bodyFatPercent !== null && (
            <div>
              <dt>Body fat · US Navy</dt>
              <dd>
                <span className={styles.metricValue}>{formatOne(results.bodyFatPercent)}%</span>
                <span className={styles.metricNote}>lean mass {formatWeight(results.leanMassKg ?? 0, units)}</span>
              </dd>
            </div>
          )}
          {results.katchMcArdleBmr !== null && results.katchMcArdleTdee !== null && (
            <div>
              <dt>BMR · Katch–McArdle</dt>
              <dd>
                <span className={styles.metricValue}>{formatInt(results.katchMcArdleBmr)}</span>
                <span className={styles.metricNote}>TDEE {formatInt(results.katchMcArdleTdee)} kcal</span>
              </dd>
            </div>
          )}
        </dl>
      )}

      {bodyFatIssue && (
        <div className={styles.callout} data-tone="warning">
          <p className={styles.calloutTitle}>Body-fat estimate not calculated</p>
          <p>{bodyFatIssue}</p>
        </div>
      )}

      <p className={styles.fineprint}>
        These are population-level equations with a typical error of around ±10% for individuals. They are a starting
        point for planning, not a medical assessment. Weight trends over several weeks are a better guide than any single
        estimate.
      </p>

      <details className={styles.disclosure}>
        <summary>Show the arithmetic</summary>
        <div className={styles.disclosureBody}>
          <FormulaBreakdown inputs={inputs} results={results} />
          <p className={styles.fineprint}>
            Calculated in metric units. <Link to="/ai?tool=explain">Ask AI to explain these numbers</Link> (optional; uses
            your Gemini key).
          </p>
        </div>
      </details>

      {canUseAsTarget && (
        <div className={styles.readoutBlock}>
          <Button onClick={() => void applyTdeeTarget()} loading={busy === 'target'} disabled={targetMatches} block>
            {targetMatches ? 'TDEE is your daily target' : 'Use TDEE as daily calorie target'}
          </Button>
          <p className={styles.fineprint}>
            {showTarget !== null ? `Your current target is ${formatInt(showTarget)} kcal. ` : ''}You can also edit targets in
            Settings.
          </p>
        </div>
      )}

      <fieldset className={styles.saveBlock}>
        <legend className={styles.blockTitle}>Save to history</legend>
        <p className={styles.fineprint}>Saving creates a new record; earlier assessments are kept.</p>
        <MeasureField
          label="Assessment date"
          type="date"
          plain
          value={date}
          max={today}
          onChange={(e) => {
            setDate(e.target.value);
            setDateError(null);
          }}
          error={dateError ?? undefined}
        />
        <NotesField label="Notes" optional rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div>
          <Button variant="primary" onClick={() => void saveAssessment()} loading={busy === 'save'}>
            Save assessment
          </Button>
        </div>
      </fieldset>
    </Readout>
  );
}
