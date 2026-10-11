import { Link } from 'react-router';
import { Panel } from '../../components/common/Panel';
import { Notice } from '../../components/feedback/Notice';
import { energyBalance } from '../../lib/calculations/energy';
import { formatInt, formatSigned } from '../../lib/formatting/numbers';
import { PROFILE_STALE_DAYS, type ProfileEstimateState } from '../../hooks/useDerived';
import styles from './Dashboard.module.css';

interface Props {
  intake: number;
  entryCount: number;
  estimate: ProfileEstimateState;
}

/**
 * Estimated energy balance = recorded intake − estimated TDEE.
 * Shown only when all inputs exist; labelled as an estimate throughout.
 */
export function EnergyPanel({ intake, entryCount, estimate }: Props) {
  if (estimate.status !== 'ok') {
    return (
      <Panel title="Energy estimate" titleId="energy-title">
        <Notice tone="neutral" title="Estimate unavailable">
          {estimate.reason}{' '}
          <Link to="/calculator">Open the calculator</Link> to estimate BMR and TDEE.
        </Notice>
      </Panel>
    );
  }
  const { bmr, tdee } = estimate.estimate.results;
  const balance = entryCount > 0 ? energyBalance(intake, tdee) : null;
  const stale = estimate.profileAgeDays !== null && estimate.profileAgeDays > PROFILE_STALE_DAYS;

  return (
    <Panel
      title="Energy estimate"
      titleId="energy-title"
      description="Population-level estimates from your profile, not measurements."
    >
      <div className="stack">
        <div className={styles.energyGrid}>
          <div className={styles.energyItem}>
            <span className={styles.energyLabel}>Estimated BMR (at rest)</span>
            <span className={styles.energyValue}>{formatInt(bmr)} kcal</span>
          </div>
          <div className={styles.energyItem}>
            <span className={styles.energyLabel}>Estimated TDEE (whole day)</span>
            <span className={styles.energyValue}>{formatInt(tdee)} kcal</span>
          </div>
          <div className={styles.energyItem}>
            <span className={styles.energyLabel}>Recorded intake today</span>
            <span className={styles.energyValue}>{formatInt(intake)} kcal</span>
          </div>
          <div className={`${styles.energyItem} ${styles.energyBalance}`}>
            <span className={styles.energyLabel}>Estimated energy balance</span>
            {balance && balance.ok ? (
              <>
                <span className={styles.energyValue}>{formatSigned(balance.value)} kcal</span>
                <span className={styles.formula}>
                  {balance.value < 0
                    ? 'Recorded intake is below estimated expenditure.'
                    : balance.value > 0
                      ? 'Recorded intake is above estimated expenditure.'
                      : 'Recorded intake matches estimated expenditure.'}{' '}
                  = recorded intake − estimated TDEE.
                </span>
              </>
            ) : (
              <span className={styles.formula}>Log food today to see recorded intake − estimated TDEE.</span>
            )}
          </div>
        </div>
        <p className="small muted">
          TDEE is an estimate and your log may be incomplete, so this balance is not an exact deficit or a prediction of
          weight change.
        </p>
        {stale && (
          <Notice tone="warning" title="Profile may be out of date">
            Your profile was last updated {estimate.profileAgeDays} days ago. <Link to="/calculator">Review it</Link> if your
            weight or activity has changed.
          </Notice>
        )}
      </div>
    </Panel>
  );
}
