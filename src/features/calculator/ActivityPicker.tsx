import { ACTIVITY_INFO } from '../../lib/calculations/energy';
import { ACTIVITY_LEVELS, type ActivityLevel } from '../../types/models';
import styles from './Calculator.module.css';

export function ActivityPicker({
  value,
  onChange,
  error,
}: {
  value: ActivityLevel | '';
  onChange: (v: ActivityLevel) => void;
  error?: string | undefined;
}) {
  return (
    <fieldset className={styles.radioGroup} aria-describedby={error ? 'activity-error' : 'activity-hint'} data-field="activity">
      <legend>Activity level</legend>
      <p id="activity-hint" className="small muted">
        Pick the description closest to a typical week. It already includes exercise, so don’t add wearable “active
        calories” on top.
      </p>
      {ACTIVITY_LEVELS.map((level) => {
        const info = ACTIVITY_INFO[level];
        return (
          <label key={level} className={styles.radioCard}>
            <input type="radio" name="activity" value={level} checked={value === level} onChange={() => onChange(level)} />
            <span className={styles.radioTitle}>{info.label}</span>
            <span className={styles.radioMult}>× {info.multiplier}</span>
            <span className={styles.radioDesc}>{info.description}</span>
          </label>
        );
      })}
      {error && (
        <span id="activity-error" className={styles.groupError}>
          {error}
        </span>
      )}
    </fieldset>
  );
}
