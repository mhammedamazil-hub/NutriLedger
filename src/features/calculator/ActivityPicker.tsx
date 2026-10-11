import { ACTIVITY_INFO } from '../../lib/calculations/energy';
import { ACTIVITY_LEVELS, type ActivityLevel } from '../../types/models';
import styles from './Calculator.module.css';

/** Five ascending bars, filled up to the level: a custom glyph instead of a stock icon. */
function IntensityGlyph({ level }: { level: number }) {
  return (
    <svg className={styles.intensity} viewBox="0 0 40 24" width="40" height="24" aria-hidden="true" focusable="false">
      {[0, 1, 2, 3, 4].map((i) => {
        const h = 8 + i * 4;
        return (
          <rect
            key={i}
            x={i * 8 + 1}
            y={24 - h}
            width="5"
            height={h}
            className={i <= level ? styles.intensityOn : styles.intensityOff}
          />
        );
      })}
    </svg>
  );
}

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
    <fieldset className={styles.activity} aria-describedby={error ? 'activity-error activity-hint' : 'activity-hint'} data-field="activity">
      <legend className="visually-hidden">Activity level</legend>
      <p id="activity-hint" className={styles.sectionLede}>
        Pick the description closest to a typical week. It already includes exercise, so don’t add wearable “active
        calories” on top.
      </p>
      <div className={styles.activityList} data-invalid={error ? 'true' : undefined}>
        {ACTIVITY_LEVELS.map((level, i) => {
          const info = ACTIVITY_INFO[level];
          return (
            <label key={level} className={styles.activityRow}>
              <input type="radio" name="activity" value={level} checked={value === level} onChange={() => onChange(level)} />
              <span className={styles.activityMark} aria-hidden="true" />
              <span className={styles.activityText}>
                <span className={styles.activityTitle}>{info.label}</span>
                <span className={styles.activityDesc}>{info.description}</span>
              </span>
              <span className={styles.activityMeta}>
                <IntensityGlyph level={i} />
                <span className={styles.activityMult}>×{info.multiplier}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <span id="activity-error" className={styles.fieldError}>
          {error}
        </span>
      )}
    </fieldset>
  );
}
