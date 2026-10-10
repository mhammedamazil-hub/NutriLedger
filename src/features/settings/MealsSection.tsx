import { useState } from 'react';
import { X } from 'lucide-react';
import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { TextField } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { isDuplicateMeal } from '../../lib/meals';
import { BOUNDS } from '../../lib/validation/bounds';
import styles from './Settings.module.css';

export function MealsSection() {
  const meals = useData((s) => s.customMeals);
  const store = useDataStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const label = name.trim().replace(/\s+/g, ' ');
    if (!label) return setError('Enter a meal name.');
    if (label.length > BOUNDS.text.meal) return setError(`Keep meal names under ${BOUNDS.text.meal} characters.`);
    if (isDuplicateMeal(label, meals)) return setError('That meal already exists.');
    if (meals.length >= BOUNDS.customMeals) return setError(`You can add up to ${BOUNDS.customMeals} custom meals.`);
    try {
      await store.saveCustomMeals([...meals, label]);
      setName('');
      setError(null);
      toast.show(`Added meal “${label}”.`);
    } catch {
      setError('Could not save. Try again.');
    }
  };

  const remove = async (m: string) => {
    try {
      await store.saveCustomMeals(meals.filter((x) => x !== m));
      toast.show(`Removed “${m}” from the meal list. Existing entries keep this label.`);
    } catch {
      toast.show('Could not remove the meal.', { tone: 'error' });
    }
  };

  return (
    <Panel
      title="Custom meals"
      titleId="meals"
      as="section"
      description="Breakfast, Lunch, Dinner, Snacks and Other are always available. Add your own, such as “Pre-workout”."
    >
      <div className="stack">
        {meals.length > 0 && (
          <ul className={styles.mealList} aria-label="Custom meals">
            {meals.map((m) => (
              <li key={m} className={styles.mealChip}>
                <span>{m}</span>
                <Button iconOnly size="sm" variant="ghost" aria-label={`Remove ${m}`} onClick={() => void remove(m)} icon={<X aria-hidden="true" />} />
              </li>
            ))}
          </ul>
        )}
        <form
          className={styles.inlineForm}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <TextField
            label="New meal name"
            value={name}
            maxLength={BOUNDS.text.meal}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            error={error ?? undefined}
          />
          <Button type="submit" disabled={meals.length >= BOUNDS.customMeals}>
            Add meal
          </Button>
        </form>
      </div>
    </Panel>
  );
}
