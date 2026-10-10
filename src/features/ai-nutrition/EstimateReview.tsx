import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { NumberField, SelectField, TextAreaField, TextField } from '../../components/forms/Field';
import formStyles from '../../components/forms/Field.module.css';
import { Notice } from '../../components/feedback/Notice';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { useTodayKey } from '../../hooks/useTodayKey';
import { mealLabel, orderedMeals } from '../../lib/meals';
import { formatDayMedium } from '../../lib/formatting/dates';
import { roundTo } from '../../lib/formatting/numbers';
import type { NutritionEstimate } from '../../lib/ai/schemas';
import { parseFoodForm, type FoodFormValues } from '../food-diary/foodForm';
import styles from './Ai.module.css';

const s = (n: number | null) => (n === null ? '' : String(roundTo(n, 1)));

function initialValues(e: NutritionEstimate, date: string): FoodFormValues {
  const notes = [`AI estimate (${e.confidence} confidence).`, e.portion_description].filter(Boolean).join(' ').slice(0, 1000);
  return {
    date,
    meal: 'other',
    name: e.food_name.slice(0, 120),
    quantity: s(e.quantity),
    unit: e.unit.slice(0, 24),
    calories: s(e.calories),
    protein: s(e.protein_g),
    carbs: s(e.carbs_g),
    fat: s(e.fat_g),
    fiber: s(e.fiber_g),
    notes,
    source: 'ai-estimate',
  };
}

/**
 * Human review step for AI estimates. Values are editable, clearly labelled as
 * unverified, and only saved when the user confirms.
 */
export function EstimateReview({ estimate, onDiscard }: { estimate: NutritionEstimate; onDiscard: () => void }) {
  const today = useTodayKey();
  const store = useDataStore();
  const toast = useToast();
  const customMeals = useData((st) => st.customMeals);
  const [values, setValues] = useState(() => initialValues(estimate, today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<{ date: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  if (estimate.status === 'needs_clarification') {
    return (
      <div className={styles.resultBox}>
        <Notice tone="info" title="Gemini needs more detail before estimating">
          Add the details below to your description and try again. No estimate was produced.
        </Notice>
        <ul className={styles.list}>
          {estimate.clarifying_questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (saved) {
    return (
      <Notice tone="success" title="Saved to your diary" role="status">
        “{saved.name}” was added to {formatDayMedium(saved.date)} as an AI estimate.{' '}
        <Link to={`/diary?date=${saved.date}`}>View in diary</Link>
        <span style={{ display: 'block', marginTop: 'var(--space-2)' }}>
          <Button size="sm" onClick={onDiscard}>
            Estimate another food
          </Button>
        </span>
      </Notice>
    );
  }

  const set = (k: keyof FoodFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValues((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: '' }));
  };

  const save = async () => {
    if (busy.current) return;
    const r = parseFoodForm(values);
    if (!r.ok) return setErrors(r.errors);
    busy.current = true;
    setSaving(true);
    try {
      await store.addFoodEntry({ ...r.value, source: 'ai-estimate' });
      setSaved({ date: r.value.date, name: r.value.name });
      toast.show(`Saved “${r.value.name}” to ${mealLabel(r.value.meal)}.`);
    } catch {
      setErrors({ name: 'Could not save to this device. Try again.' });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <form
      className={styles.resultBox}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      aria-labelledby="estimate-title"
    >
      <div className={styles.resultHead}>
        <h3 id="estimate-title" style={{ fontSize: 'var(--text-md)' }}>
          Review the estimate
        </h3>
        <span className="row" style={{ gap: 'var(--space-2)' }}>
          <Badge tone="ai">AI estimate — unverified</Badge>
          <Badge tone={estimate.confidence === 'low' ? 'warning' : 'neutral'}>{estimate.confidence} confidence</Badge>
        </span>
      </div>
      <p className="small muted">
        These numbers are Gemini’s guess, not measured or looked up. Check them against a label or your portion, edit anything
        that looks wrong, then save.
      </p>
      {estimate.assumptions.length > 0 && (
        <div>
          <p className="small" style={{ fontWeight: 600 }}>
            Assumptions made
          </p>
          <ul className={styles.list}>
            {estimate.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <TextField label="Food name" value={values.name} onChange={set('name')} error={errors.name} maxLength={120} />
      <div className={formStyles.grid2}>
        <NumberField label="Quantity" optional value={values.quantity} onChange={set('quantity')} error={errors.quantity} />
        <TextField label="Unit" optional value={values.unit} onChange={set('unit')} error={errors.unit} maxLength={24} />
      </div>
      <div className={formStyles.grid3}>
        <NumberField label="Calories" suffix="kcal" value={values.calories} onChange={set('calories')} error={errors.calories} />
        <NumberField label="Protein" optional suffix="g" value={values.protein} onChange={set('protein')} error={errors.protein} />
        <NumberField label="Carbohydrate" optional suffix="g" value={values.carbs} onChange={set('carbs')} error={errors.carbs} />
        <NumberField label="Fat" optional suffix="g" value={values.fat} onChange={set('fat')} error={errors.fat} />
        <NumberField label="Fiber" optional suffix="g" value={values.fiber} onChange={set('fiber')} error={errors.fiber} />
      </div>
      <div className={formStyles.grid2}>
        <TextField label="Date" type="date" value={values.date} onChange={set('date')} error={errors.date} />
        <SelectField label="Meal" value={values.meal} onChange={set('meal')} error={errors.meal}>
          {orderedMeals(customMeals).map((m) => (
            <option key={m} value={m}>
              {mealLabel(m)}
            </option>
          ))}
        </SelectField>
      </div>
      <TextAreaField label="Notes" optional rows={2} value={values.notes} onChange={set('notes')} error={errors.notes} maxLength={1000} />
      <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Button type="submit" variant="primary" loading={saving}>
          Save to diary
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
      </div>
    </form>
  );
}
