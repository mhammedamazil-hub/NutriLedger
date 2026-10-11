import { useMemo, useRef, useState } from 'react';
import { Dialog } from '../../components/dialogs/Dialog';
import { Button } from '../../components/common/Button';
import { NumberField, SelectField, TextAreaField, TextField } from '../../components/forms/Field';
import formStyles from '../../components/forms/Field.module.css';
import { Notice } from '../../components/feedback/Notice';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { mealLabel, orderedMeals } from '../../lib/meals';
import { formatInt } from '../../lib/formatting/numbers';
import type { FoodEntry } from '../../types/models';
import { emptyFoodForm, entryToForm, parseFoodForm, type FoodFormValues } from './foodForm';
import { PortionCalculator } from './PortionCalculator';
import styles from './Diary.module.css';
import { saveErrorMessage } from '../../lib/database/errors';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Entry being edited, or null to create. */
  entry: FoodEntry | null;
  defaultDate: string;
  defaultMeal?: string;
  /** Pre-fills a new entry from an existing one (duplicate). The copy uses `defaultDate`. */
  template?: FoodEntry | null;
}

export function FoodEntryDialog(props: Props) {
  // Remount the form whenever the dialog opens for a different target so state is fresh.
  if (!props.open) return <Dialog open={false} title="" onClose={props.onClose}>{null}</Dialog>;
  return <FoodEntryForm key={`${props.entry?.id ?? 'new'}-${props.template?.id ?? ''}-${props.defaultDate}-${props.defaultMeal ?? ''}`} {...props} />;
}

function FoodEntryForm({ open, onClose, entry, defaultDate, defaultMeal, template }: Props) {
  const store = useDataStore();
  const toast = useToast();
  const customMeals = useData((s) => s.customMeals);
  const initial = useMemo(
    () => (entry ? entryToForm(entry) : template ? { ...entryToForm(template), date: defaultDate } : emptyFoodForm(defaultDate, defaultMeal)),
    [entry, template, defaultDate, defaultMeal],
  );
  const [values, setValues] = useState<FoodFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const submitting = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const meals = orderedMeals(customMeals, [values.meal]);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useUnsavedChanges(dirty);

  const set = (key: keyof FoodFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const save = async (addAnother: boolean) => {
    if (submitting.current) return; // guards against double taps
    const parsed = parseFoodForm(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = Object.keys(parsed.errors)[0];
      if (first) document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select`)?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      if (entry) {
        await store.updateFoodEntry(entry.id, parsed.value);
        toast.show(`Updated “${parsed.value.name}”.`);
        onClose();
      } else {
        await store.addFoodEntry(parsed.value);
        toast.show(`Saved “${parsed.value.name}” to ${mealLabel(parsed.value.meal)} (${formatInt(parsed.value.calories)} kcal).`);
        if (addAnother) {
          setValues((prev) => ({ ...emptyFoodForm(prev.date, prev.meal) }));
          setErrors({});
          setSavedCount((c) => c + 1);
          nameRef.current?.focus();
        } else {
          onClose();
        }
      }
    } catch (err) {
      setSaveError(
        err instanceof Error && /no longer exists/.test(err.message)
          ? err.message
          : saveErrorMessage(err, 'The entry could not be saved to this device. Your input is still here — try again.'),
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      wide
      title={entry ? 'Edit food entry' : template ? 'Duplicate food entry' : 'Add food'}
      onClose={requestClose}
      canClose={() => {
        if (saving) return false;
        if (dirty && !confirmDiscard) {
          setConfirmDiscard(true);
          return false;
        }
        return true;
      }}
      footer={
        confirmDiscard ? (
          <>
            <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button variant="danger" onClick={onClose}>
              Discard changes
            </Button>
          </>
        ) : (
          <>
            <Button onClick={requestClose} disabled={saving}>
              Cancel
            </Button>
            {!entry && (
              <Button onClick={() => void save(true)} disabled={saving}>
                Save and add another
              </Button>
            )}
            <Button variant="primary" onClick={() => void save(false)} loading={saving}>
              {entry ? 'Save changes' : 'Save entry'}
            </Button>
          </>
        )
      }
    >
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        {confirmDiscard && (
          <Notice tone="warning" role="alert" title="Discard unsaved changes?">
            Your edits to this entry have not been saved.
          </Notice>
        )}
        {savedCount > 0 && !entry && (
          <Notice tone="success" role="status">
            {savedCount} {savedCount === 1 ? 'entry' : 'entries'} saved this session. Add the next one below.
          </Notice>
        )}
        {saveError && (
          <Notice tone="danger" role="alert">
            {saveError}
          </Notice>
        )}
        {entry?.source === 'ai-estimate' && (
          <Notice tone="info">This entry started as an AI estimate that you reviewed. Values are approximate.</Notice>
        )}

        <div className={formStyles.grid2}>
          <div data-field="date">
            <TextField label="Date" type="date" value={values.date} onChange={set('date')} error={errors.date} required />
          </div>
          <div data-field="meal">
            <SelectField label="Meal" value={values.meal} onChange={set('meal')} error={errors.meal}>
              {meals.map((m) => (
                <option key={m} value={m}>
                  {mealLabel(m)}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        <div data-field="name">
          <TextField
            ref={nameRef}
            label="Food name"
            value={values.name}
            onChange={set('name')}
            error={errors.name}
            maxLength={120}
            autoComplete="off"
            required
          />
        </div>

        <div className={formStyles.grid2}>
          <div data-field="quantity">
            <NumberField
              label="Quantity"
              optional
              value={values.quantity}
              onChange={set('quantity')}
              error={errors.quantity}
              hint="How much you ate"
            />
          </div>
          <div data-field="unit">
            <TextField
              label="Unit"
              optional
              value={values.unit}
              onChange={set('unit')}
              error={errors.unit}
              list="unit-suggestions"
              maxLength={24}
              hint="e.g. g, ml, cup, slice"
            />
            <datalist id="unit-suggestions">
              {['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'slice', 'piece', 'serving', 'bowl'].map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
        </div>

        <p className={styles.formSectionTitle}>Nutrition for the whole portion you ate</p>
        <div className={formStyles.grid3}>
          <div data-field="calories">
            <NumberField label="Calories" suffix="kcal" value={values.calories} onChange={set('calories')} error={errors.calories} required />
          </div>
          <div data-field="protein">
            <NumberField label="Protein" optional suffix="g" value={values.protein} onChange={set('protein')} error={errors.protein} />
          </div>
          <div data-field="carbs">
            <NumberField label="Carbohydrate" optional suffix="g" value={values.carbs} onChange={set('carbs')} error={errors.carbs} />
          </div>
          <div data-field="fat">
            <NumberField label="Fat" optional suffix="g" value={values.fat} onChange={set('fat')} error={errors.fat} />
          </div>
          <div data-field="fiber">
            <NumberField label="Fiber" optional suffix="g" value={values.fiber} onChange={set('fiber')} error={errors.fiber} />
          </div>
        </div>
        <p className="small muted">Leave a macro empty if you don’t know it — it will be shown as “not recorded”, not as zero.</p>

        <PortionCalculator
          eatenQuantity={values.quantity}
          unit={values.unit}
          onApply={(v) => {
            setValues((prev) => ({ ...prev, ...v }));
            setErrors((prev) => ({ ...prev, calories: '', protein: '', carbs: '', fat: '', fiber: '' }));
          }}
        />

        <div className={formStyles.grid2}>
          <SelectField
            label="Nutrition source"
            value={values.source}
            onChange={(e) => setValues((p) => ({ ...p, source: e.target.value as FoodFormValues['source'] }))}
          >
            <option value="manual">Entered by me</option>
            <option value="label">From a food label</option>
            {values.source === 'ai-estimate' && <option value="ai-estimate">AI estimate (reviewed)</option>}
          </SelectField>
        </div>

        <TextAreaField label="Notes" optional value={values.notes} onChange={set('notes')} error={errors.notes} maxLength={1000} rows={2} />
        {/* Hidden submit so Enter in a text field saves. */}
        <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
      </form>
    </Dialog>
  );
}
