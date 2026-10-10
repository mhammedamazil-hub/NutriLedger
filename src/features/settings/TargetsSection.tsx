import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { NumberField } from '../../components/forms/Field';
import formStyles from '../../components/forms/Field.module.css';
import { Notice } from '../../components/feedback/Notice';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { BOUNDS, LOW_TARGET_CAUTION_KCAL } from '../../lib/validation/bounds';
import { formatInt, parseNumberInput } from '../../lib/formatting/numbers';
import type { Targets } from '../../types/models';
import { parseTargets, type TargetKey } from './targetsForm';
import { saveErrorMessage } from '../../lib/database/errors';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

type Key = TargetKey;
const str = (n: number | null) => (n === null ? '' : String(n));

export function TargetsSection() {
  const targets = useData((s) => s.targets);
  const age = useData((s) => s.profile.age);
  const store = useDataStore();
  const toast = useToast();
  const toForm = (t: Targets) => ({ calories: str(t.calories), protein: str(t.protein), carbs: str(t.carbs), fat: str(t.fat) });
  const [values, setValues] = useState(() => toForm(targets));
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const savedForm = toForm(targets);
  const dirty = JSON.stringify(values) !== JSON.stringify(savedForm);
  useUnsavedChanges(dirty);
  const typedCalories = parseNumberInput(values.calories);
  const low = typedCalories !== null && !Number.isNaN(typedCalories) && typedCalories >= BOUNDS.targetCalories.min && typedCalories < LOW_TARGET_CAUTION_KCAL;

  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValues((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const save = async (next: Record<Key, number | null>) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      const calorieSource =
        next.calories === null ? null : next.calories === targets.calories ? targets.calorieSource : ('manual' as const);
      await store.saveTargets({ ...next, calorieSource });
      setValues(toForm({ ...targets, ...next }));
      toast.show(next.calories === null && next.protein === null && next.carbs === null && next.fat === null ? 'Targets cleared.' : 'Targets saved.');
    } catch (err) {
      toast.show(saveErrorMessage(err, 'Targets could not be saved.'), { tone: 'error', durationMs: 10000 });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Daily targets"
      titleId="targets"
      as="section"
      description="Optional. NutriLedger never sets a target for you; leave fields empty to track without targets."
    >
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const r = parseTargets(values);
          if (!r.ok) return setErrors(r.errors);
          void save(r.value);
        }}
      >
        {targets.calorieSource === 'tdee-estimate' && targets.calories !== null && (
          <p className="small muted">Your calorie target came from your TDEE estimate. Editing it makes it a manual target.</p>
        )}
        {age !== null && age < 18 && (
          <Notice tone="info">
            For people under 18, calorie and macro targets should come from a doctor or registered dietitian.
          </Notice>
        )}
        <div className={formStyles.grid2}>
          <NumberField label="Calories" optional suffix="kcal" value={values.calories} onChange={set('calories')} error={errors.calories} />
          <NumberField label="Protein" optional suffix="g" value={values.protein} onChange={set('protein')} error={errors.protein} />
          <NumberField label="Carbohydrate" optional suffix="g" value={values.carbs} onChange={set('carbs')} error={errors.carbs} />
          <NumberField label="Fat" optional suffix="g" value={values.fat} onChange={set('fat')} error={errors.fat} />
        </div>
        {low && (
          <Notice tone="warning" title="This is a low calorie target">
            Targets below about {formatInt(LOW_TARGET_CAUTION_KCAL)} kcal a day can make it hard to meet nutrient needs. Consider
            discussing it with a doctor or registered dietitian. You can still save it.
          </Notice>
        )}
        <p className="small muted">
          Need a starting point? The <Link to="/calculator">calculator</Link> can set your calorie target from an estimated TDEE.
        </p>
        <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Save targets
          </Button>
          {(targets.calories !== null || targets.protein !== null || targets.carbs !== null || targets.fat !== null) && (
            <Button variant="ghost" disabled={saving} onClick={() => void save({ calories: null, protein: null, carbs: null, fat: null })}>
              Clear all targets
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}
