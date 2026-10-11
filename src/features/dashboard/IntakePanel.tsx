import { Link } from 'react-router';
import { Panel } from '../../components/common/Panel';
import type { NutritionTotals } from '../../lib/calculations/nutrition';
import { formatInt, pluralize } from '../../lib/formatting/numbers';
import type { Targets } from '../../types/models';
import styles from './Dashboard.module.css';

export function IntakePanel({ totals, targets, today }: { totals: NutritionTotals; targets: Targets; today: string }) {
  const target = targets.calories;
  const remaining = target !== null ? target - totals.calories : null;
  const pct = target ? Math.min(100, (totals.calories / target) * 100) : 0;
  const over = remaining !== null && remaining < 0;

  return (
    <Panel title="Calories recorded today" titleId="intake-title">
      <div className={styles.intakeTop}>
        <div>
          <span className={styles.bigNumber}>
            {formatInt(totals.calories)}
            <span className={styles.bigUnit}>kcal</span>
          </span>
          <p className={styles.caption}>
            {totals.entryCount === 0 ? (
              <>
                Nothing logged yet today. <Link to={`/diary?date=${today}&add=1`}>Add a food</Link>
              </>
            ) : (
              `From ${pluralize(totals.entryCount, 'entry', 'entries')} in your diary`
            )}
          </p>
        </div>
        <div className={styles.targetBox}>
          {target !== null ? (
            <>
              <span className="muted">
                {targets.calorieSource === 'tdee-estimate' ? 'Target (from TDEE estimate)' : 'Your daily target'}
              </span>
              <span className={styles.targetValue}>{formatInt(target)} kcal</span>
            </>
          ) : (
            <>
              <span className="muted">No daily target set</span>
              <Link to="/settings#targets" className="tap-link">
                Set a target
              </Link>
            </>
          )}
        </div>
      </div>
      {target !== null && remaining !== null && (
        <>
          <div className={styles.track} aria-hidden="true">
            <div className={`${styles.fill} ${over ? styles.fillOver : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <p className={styles.statusLine}>
            {over ? (
              <>
                <strong>{formatInt(-remaining)} kcal</strong> above your target
              </>
            ) : (
              <>
                <strong>{formatInt(remaining)} kcal</strong> remaining of your target
              </>
            )}
            <span className="muted"> · {formatInt((totals.calories / target) * 100)}% recorded</span>
          </p>
        </>
      )}
    </Panel>
  );
}
