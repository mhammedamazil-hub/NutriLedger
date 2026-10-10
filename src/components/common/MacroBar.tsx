import { formatOne } from '../../lib/formatting/numbers';
import type { MacroTotal } from '../../lib/calculations/nutrition';
import styles from './MacroBar.module.css';

interface Props {
  label: string;
  color: string;
  total: MacroTotal;
  entryCount: number;
  target: number | null;
}

/** One macro total with optional progress toward a configured target. Text always carries the meaning. */
export function MacroBar({ label, color, total, entryCount, target }: Props) {
  const recorded = total.recordedCount > 0;
  const pct = target && recorded ? Math.min(100, (total.total / target) * 100) : 0;
  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <span className={styles.label}>
          <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
          {label}
        </span>
        <span className={styles.value}>
          {recorded ? `${formatOne(total.total)} g` : entryCount ? 'Not recorded' : '0 g'}
          {target ? <span className="muted"> / {formatOne(target)} g target</span> : null}
        </span>
      </div>
      {target ? (
        <div className={styles.track} aria-hidden="true">
          <div className={styles.fill} style={{ width: `${pct}%`, background: color }} />
        </div>
      ) : null}
      {entryCount > 0 && recorded && !total.complete && (
        <span className={styles.note}>
          Includes {total.recordedCount} of {entryCount} entries — others did not record {label.toLowerCase()}.
        </span>
      )}
    </div>
  );
}
