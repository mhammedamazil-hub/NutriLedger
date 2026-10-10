import { useMemo } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/common/Panel';
import { useData } from '../../app/dataContext';
import { usePreferences } from '../../app/preferences';
import { formatWeight, formatOne } from '../../lib/formatting/numbers';
import { formatDayMedium } from '../../lib/formatting/dates';
import { kgToLb } from '../../lib/calculations/units';
import styles from './Dashboard.module.css';

/** Only rendered when weight records exist. Shows recorded change — never a projection. */
export function WeightSnapshot() {
  const weights = useData((s) => s.weights);
  const { units } = usePreferences();
  const sorted = useMemo(
    () => [...weights].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    [weights],
  );
  const latest = sorted.at(-1);
  if (!latest) return null;
  const previous = sorted.at(-2);
  const diffKg = previous ? latest.weightKg - previous.weightKg : null;
  const diffDisplay = diffKg === null ? null : units === 'imperial' ? kgToLb(diffKg) : diffKg;
  const unit = units === 'imperial' ? 'lb' : 'kg';

  return (
    <Panel
      title="Latest weight"
      titleId="weight-title"
      actions={
        <Link to="/progress" className="small tap-link">
          Progress
        </Link>
      }
    >
      <div className={styles.weightRow}>
        <span className={styles.energyValue}>{formatWeight(latest.weightKg, units)}</span>
        <span className="muted small">recorded {formatDayMedium(latest.date)}</span>
      </div>
      {diffDisplay !== null && previous && (
        <p className="small muted" style={{ marginTop: 4 }}>
          {diffDisplay === 0
            ? 'Same as'
            : `${diffDisplay > 0 ? '+' : '−'}${formatOne(Math.abs(diffDisplay))} ${unit} compared with`}{' '}
          the previous record on {formatDayMedium(previous.date)}.
        </p>
      )}
    </Panel>
  );
}
