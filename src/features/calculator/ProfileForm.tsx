import { useRef, useState } from 'react';
import { Button } from '../../components/common/Button';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { preferencesStore, usePreferences } from '../../app/preferences';
import type { UnitSystem } from '../../types/models';
import { parseCalcForm, profileToForm, switchFormUnits, type CalcFormValues, type UnitSwitchMemo } from './calculatorForm';
import { ActivityPicker } from './ActivityPicker';
import { ArrowGlyph, MeasureField, Toggle } from './CalcControls';
import styles from './Calculator.module.css';
import { saveErrorMessage } from '../../lib/database/errors';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

type Errors = Partial<Record<keyof CalcFormValues | 'height', string>>;

/** Bring the readout into view only when it is not already visible (it is sticky on wide layouts). */
function revealResults() {
  const el = document.getElementById('results-title');
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  const clearance = parseFloat(getComputedStyle(el).scrollMarginTop) || 0; // clears the mobile top bar
  if (top >= clearance && top <= window.innerHeight * 0.6) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}

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
  const unitMemo = useRef<UnitSwitchMemo | null>(null);

  const saved = profileToForm(profile, units);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  useUnsavedChanges(dirty);
  const imperial = units === 'imperial';
  const lenUnit = imperial ? 'in' : 'cm';

  const set = (key: keyof CalcFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValues((p) => ({ ...p, [key]: v }));
    setErrors((p) => ({ ...p, [key]: undefined, ...(key.startsWith('height') ? { height: undefined } : {}) }));
  };

  const changeUnits = (next: UnitSystem) => {
    if (dirty) {
      // Unsaved input: convert, restoring untouched fields exactly when switching back.
      const r = switchFormUnits(values, units, next, unitMemo.current);
      unitMemo.current = r.memo;
      setValues(r.values);
    } else {
      // Nothing typed: re-display the stored metric values, which is always exact.
      unitMemo.current = null;
      setValues(profileToForm(profile, next));
    }
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
      // Wait for the ready readout to commit and lay out, so the scroll target doesn't move mid-scroll.
      requestAnimationFrame(() => requestAnimationFrame(revealResults));
    } catch (err) {
      setSaveError(saveErrorMessage(err, 'Your profile could not be saved on this device. Your input is still here — try again.'));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <section className={styles.form} aria-labelledby="profile-title">
      <h2 id="profile-title" className="visually-hidden">
        Your details
      </h2>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className={styles.section} role="group" aria-labelledby="calc-body-title">
          <span className={styles.sectionIndex} aria-hidden="true">
            01
          </span>
          <div className={styles.sectionHead}>
            <h3 id="calc-body-title" className={styles.sectionTitle}>
              Body
            </h3>
            <p className={styles.sectionLede}>Used only on this device. Stored in metric, shown in your chosen units.</p>
          </div>
          <div className={styles.sectionBody}>
            <Toggle
              legend="Units"
              name="units"
              value={units}
              onChange={changeUnits}
              options={[
                { value: 'metric', label: 'Metric', detail: 'kg, cm' },
                { value: 'imperial', label: 'Imperial', detail: 'lb, ft/in' },
              ]}
            />
            <div className={styles.fieldRow}>
              <div data-field="age">
                <MeasureField label="Age" unit="years" value={values.age} onChange={set('age')} error={errors.age} />
              </div>
              <div data-field="weight">
                <MeasureField label="Weight" unit={imperial ? 'lb' : 'kg'} value={values.weight} onChange={set('weight')} error={errors.weight} />
              </div>
              {imperial ? (
                <div className={styles.heightPair}>
                  <div data-field="heightFt">
                    <MeasureField label="Height (feet)" unit="ft" value={values.heightFt} onChange={set('heightFt')} error={errors.heightFt} />
                  </div>
                  <div data-field="heightIn">
                    <MeasureField label="Height (inches)" unit="in" value={values.heightIn} onChange={set('heightIn')} error={errors.heightIn} />
                  </div>
                  {errors.height && <p className={styles.fieldError}>{errors.height}</p>}
                </div>
              ) : (
                <div data-field="heightCm">
                  <MeasureField label="Height" unit="cm" value={values.heightCm} onChange={set('heightCm')} error={errors.heightCm ?? errors.height} />
                </div>
              )}
            </div>
            <div data-field="sex">
              <Toggle
                legend="Equation variant (sex)"
                name="sex"
                value={values.sex === '' ? null : values.sex}
                onChange={(v) => {
                  setValues((p) => ({ ...p, sex: v }));
                  setErrors((p) => ({ ...p, sex: undefined }));
                }}
                error={errors.sex}
                hint="The published equations have separate male and female versions based on average physiology."
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className={styles.section} role="group" aria-labelledby="calc-activity-title">
          <span className={styles.sectionIndex} aria-hidden="true">
            02
          </span>
          <div className={styles.sectionHead}>
            <h3 id="calc-activity-title" className={styles.sectionTitle}>
              Activity
            </h3>
          </div>
          <div className={styles.sectionBody}>
            <ActivityPicker
              value={values.activity}
              error={errors.activity}
              onChange={(v) => {
                setValues((p) => ({ ...p, activity: v }));
                setErrors((p) => ({ ...p, activity: undefined }));
              }}
            />
          </div>
        </div>

        <div className={styles.section} role="group" aria-labelledby="calc-measure-title">
          <span className={styles.sectionIndex} aria-hidden="true">
            03
          </span>
          <div className={styles.sectionHead}>
            <h3 id="calc-measure-title" className={styles.sectionTitle}>
              Measurements
            </h3>
            <p className={styles.sectionLede}>Optional. Adds a body-fat estimate and a second equation.</p>
          </div>
          <div className={styles.sectionBody}>
            <details className={styles.disclosure} open={Boolean(values.neck || values.waist || values.hip) || undefined}>
              <summary>Body measurements (optional)</summary>
              <div className={styles.disclosureBody}>
                <p className={styles.helper}>
                  Neck and waist (plus hip for the female equation) enable a US Navy body-fat estimate and the
                  Katch–McArdle equation. Measure with a flexible tape: neck just below the larynx; waist at the navel
                  (male) or narrowest point (female); hip at the widest point.
                </p>
                <div className={styles.fieldRow}>
                  <div data-field="neck">
                    <MeasureField label="Neck" optional unit={lenUnit} value={values.neck} onChange={set('neck')} error={errors.neck} />
                  </div>
                  <div data-field="waist">
                    <MeasureField label="Waist" optional unit={lenUnit} value={values.waist} onChange={set('waist')} error={errors.waist} />
                  </div>
                  <div data-field="hip">
                    <MeasureField
                      label="Hip"
                      optional
                      unit={lenUnit}
                      value={values.hip}
                      onChange={set('hip')}
                      error={errors.hip}
                      hint={values.sex === 'male' ? 'Not used by the male equation' : undefined}
                    />
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className={styles.commit}>
          {saveError && (
            <p className={styles.callout} data-tone="danger" role="alert">
              {saveError}
            </p>
          )}
          {Object.values(errors).some(Boolean) && (
            <p className={styles.callout} data-tone="danger" role="alert">
              Some details need attention. Check the highlighted fields.
            </p>
          )}
          <div className={styles.commitRow}>
            <Button type="submit" variant="primary" loading={saving} className={styles.calculate}>
              Calculate
              <ArrowGlyph />
            </Button>
            <p className={styles.helper}>Saves your details on this device and updates the readout.</p>
          </div>
          {dirty && profile.updatedAt && (
            <div className={styles.dirtyRow}>
              <p className={styles.helper} role="status">
                You have unsaved changes. Results reflect your last saved profile.
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  setValues(saved);
                  setErrors({});
                }}
              >
                Revert changes
              </Button>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
