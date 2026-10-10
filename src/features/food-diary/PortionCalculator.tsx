import { useState } from 'react';
import { Button } from '../../components/common/Button';
import { NumberField } from '../../components/forms/Field';
import formStyles from '../../components/forms/Field.module.css';
import { Notice } from '../../components/feedback/Notice';
import { scaleNutrition } from '../../lib/calculations/nutrition';
import { parseNumberInput, roundTo } from '../../lib/formatting/numbers';
import styles from './Diary.module.css';

interface Props {
  eatenQuantity: string;
  unit: string;
  onApply: (values: { calories: string; protein: string; carbs: string; fat: string; fiber: string }) => void;
}

const num = (s: string) => {
  const n = parseNumberInput(s);
  return n === null || Number.isNaN(n) ? null : n;
};

/**
 * Scales label values to the amount eaten:
 *   portion value = reference value × amount eaten ÷ reference amount
 * Both amounts must be in the same unit; no unit conversion is attempted.
 */
export function PortionCalculator({ eatenQuantity, unit, onApply }: Props) {
  const [ref, setRef] = useState({ quantity: '100', calories: '', protein: '', carbs: '', fat: '', fiber: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof ref) => (e: React.ChangeEvent<HTMLInputElement>) => setRef((r) => ({ ...r, [k]: e.target.value }));
  const unitLabel = unit.trim() || 'units';

  const apply = () => {
    const eaten = num(eatenQuantity);
    const refQty = num(ref.quantity);
    const kcal = num(ref.calories);
    if (eaten === null) return setError('Enter the amount you ate in the Quantity field above first.');
    if (refQty === null) return setError('Enter the reference amount from the label.');
    if (kcal === null) return setError('Enter the reference calories.');
    const r = scaleNutrition(
      { calories: kcal, protein: num(ref.protein), carbs: num(ref.carbs), fat: num(ref.fat), fiber: num(ref.fiber) },
      refQty,
      eaten,
    );
    if (!r.ok) return setError(r.reason);
    setError(null);
    const f = (n: number | null) => (n === null ? '' : String(roundTo(n, 1)));
    onApply({ calories: f(r.value.calories), protein: f(r.value.protein), carbs: f(r.value.carbs), fat: f(r.value.fat), fiber: f(r.value.fiber) });
  };

  return (
    <details className={styles.portionBox}>
      <summary>Calculate from a nutrition label</summary>
      <div className="stack" style={{ marginTop: 'var(--space-2)' }}>
        <p className="small muted">
          Enter the label values for a reference amount in the same unit as your quantity ({unitLabel}). NutriLedger scales
          them: portion value = label value × amount eaten ÷ reference amount.
        </p>
        <div className={formStyles.grid3}>
          <NumberField label={`Reference amount (${unitLabel})`} value={ref.quantity} onChange={set('quantity')} />
          <NumberField label="Calories (kcal)" value={ref.calories} onChange={set('calories')} />
          <NumberField label="Protein (g)" optional value={ref.protein} onChange={set('protein')} />
          <NumberField label="Carbohydrate (g)" optional value={ref.carbs} onChange={set('carbs')} />
          <NumberField label="Fat (g)" optional value={ref.fat} onChange={set('fat')} />
          <NumberField label="Fiber (g)" optional value={ref.fiber} onChange={set('fiber')} />
        </div>
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <div>
          <Button size="sm" onClick={apply}>
            Apply to this portion
          </Button>
        </div>
      </div>
    </details>
  );
}
