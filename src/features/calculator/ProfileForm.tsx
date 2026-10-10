import { useRef, useState } from 'react';
import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { NumberField, Segmented } from '../../components/forms/Field';
import formStyles from '../../components/forms/Field.module.css';
import { Notice } from '../../components/feedback/Notice';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { preferencesStore, usePreferences } from '../../app/preferences';
import type { UnitSystem } from '../../types/models';
import { convertFormUnits, parseCalcForm, profileToForm, type CalcFormValues } from './calculatorForm';
import { ActivityPicker } from './ActivityPicker';
import styles from './Calculator.module.css';

type Errors = Partial<Record<keyof CalcFormValues | 'height', string>>;

export function ProfileForm() {
  const store = useDataStore();
  const toast = useToast();
  const profile = useData((s) => s.profile);
  const { units } = usePreferences();
  const [values, setValues] = useState<CalcFormValues>(() => profileToForm(profile, units));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const busy = useRef(false);

  const saved = profileToForm(profile, units);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const imperial = units === 'imperial';
  const lenUnit = imperial ? 'in' : 'cm';

  const set = (key: keyof CalcFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValues((p) => ({ ...p, [key]: v }));
    setErrors((p) => ({ ...p, [key]: undefined, ...(key.startsWith('height') ? { height: undefined } : {}) }));
  };

  const changeUnits = (next: UnitSystem) => {
    setValues((p) => (dirty ? convertFormUnits(p, units, next) : profileToForm(profile, next)));
    setErrors({});
    preferencesStore.update({ units: next });
  };

  const submit = async () => {
    if (busy.current) return;
    const r = parseCalcForm(values, units);
    if (!r.ok) {
      setErrors(r.errors);
      const first = Object.keys(r.errors)[0];
      const target = first === 'height' ? (imperial ? 'heightFt' : 'heightCm') : first;
      document.querySelector<HTMLElement>(`[data-field="${target}"] input`)?.focus();
      return;
    }
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await store.saveProfile(r.profile);
      setValues(profileToForm({ ...r.profile, updatedAt: null }, units));
      toast.show('Profile saved. Results updated.');
      document.getElementById('results-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch {
      setSaveError('Your profile could not be saved on this device. Your input is still here — try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Your details"
      titleId="profile-title"
      description="Used only on this device to estimate energy needs. Stored in metric; shown in your chosen units."
    >
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Segmented
          legend="Units"
          name="units"
          value={units}
          onChange={changeUnits}
          options={[
            { value: 'metric', label: 'Metric (kg, cm)' },
            { value: 'imperial', label: 'Imperial (lb, ft/in)' },
          ]}
        />

        <div className={formStyles.grid2}>
          <div data-field="age">
            <NumberField label="Age" suffix="years" value={values.age} onChange={set('age')} error={errors.age} />
          </div>
          <div data-field="weight">
            <NumberField label="Weight" suffix={imperial ? 'lb' : 'kg'} value={values.weight} onChange={set('weight')} error={errors.weight} />
          </div>
        </div>

        <div data-field="sex">
          <Segmented
            legend="Equation variant (sex)"
            name="sex"
            value={values.sex === '' ? null : values.sex}
            onChange={(v) => {
              setValues((p) => ({ ...p, sex: v }));
              setErrors((p) => ({ ...p, sex: undefined }));
            }}
            error={errors.sex}
            options={[
              { value: 'female', label: 'Female' },
              { value: 'male', label: 'Male' },
            ]}
          />
          <p className="small muted" style={{ marginTop: 4 }}>
            The published equations have separate male and female versions based on average physiology.
          </p>
        </div>

        {imperial ? (
          <div>
            <div className={styles.heightRow}>
              <div data-field="heightFt">
                <NumberField label="Height (feet)" suffix="ft" value={values.heightFt} onChange={set('heightFt')} error={errors.heightFt} />
              </div>
              <div data-field="heightIn">
                <NumberField label="Height (inches)" suffix="in" value={values.heightIn} onChange={set('heightIn')} error={errors.heightIn} />
              </div>
            </div>
            {errors.height && <p className={styles.groupError}>{errors.height}</p>}
          </div>
        ) : (
          <div data-field="heightCm">
            <NumberField label="Height" suffix="cm" value={values.heightCm} onChange={set('heightCm')} error={errors.heightCm ?? errors.height} />
          </div>
        )}

        <ActivityPicker
          value={values.activity}
          error={errors.activity}
          onChange={(v) => {
            setValues((p) => ({ ...p, activity: v }));
            setErrors((p) => ({ ...p, activity: undefined }));
          }}
        />

        <details className={styles.details} open={Boolean(values.neck || values.waist || values.hip) || undefined}>
          <summary>Body measurements (optional)</summary>
          <div className="stack">
            <p className="small muted">
              Neck and waist (plus hip for the female equation) enable a US Navy body-fat estimate and the Katch–McArdle
              equation. Measure with a flexible tape: neck just below the larynx; waist at the navel (male) or narrowest
              point (female); hip at the widest point.
            </p>
            <div className={formStyles.grid3}>
              <div data-field="neck">
                <NumberField label="Neck" optional suffix={lenUnit} value={values.neck} onChange={set('neck')} error={errors.neck} />
              </div>
              <div data-field="waist">
                <NumberField label="Waist" optional suffix={lenUnit} value={values.waist} onChange={set('waist')} error={errors.waist} />
              </div>
              <div data-field="hip">
                <NumberField
                  label="Hip"
                  optional
                  suffix={lenUnit}
                  value={values.hip}
                  onChange={set('hip')}
                  error={errors.hip}
                  hint={values.sex === 'male' ? 'Not used by the male equation' : undefined}
                />
              </div>
            </div>
          </div>
        </details>

        {saveError && (
          <Notice tone="danger" role="alert">
            {saveError}
          </Notice>
        )}
        {Object.values(errors).some(Boolean) && (
          <Notice tone="danger" role="alert">
            Some details need attention. Check the highlighted fields.
          </Notice>
        )}
        <div className={styles.actions}>
          <Button type="submit" variant="primary" loading={saving}>
            Calculate and save profile
          </Button>
          {dirty && profile.updatedAt && (
            <Button
              variant="ghost"
              onClick={() => {
                setValues(saved);
                setErrors({});
              }}
            >
              Revert changes
            </Button>
          )}
        </div>
        {dirty && profile.updatedAt && (
          <p className="small muted" role="status">
            You have unsaved changes. Results reflect your last saved profile.
          </p>
        )}
      </form>
    </Panel>
  );
}
