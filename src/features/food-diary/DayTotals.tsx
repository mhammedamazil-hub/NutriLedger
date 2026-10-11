import type { MacroTotal, NutritionTotals } from '../../lib/calculations/nutrition';
import { formatInt, formatOne } from '../../lib/formatting/numbers';
import type { Targets } from '../../types/models';
import styles from './Diary.module.css';

function macroNote(t: MacroTotal, count: number): string | null {
  if (count === 0) return null;
  if (t.recordedCount === 0) return 'Not recorded';
  if (t.recordedCount < count) return `Recorded for ${t.recordedCount} of ${count}`;
  return null;
}

/** Day totals. Uses the same `totalsFor` as the dashboard so figures always agree. */
export function DayTotals({ totals, targets }: { totals: NutritionTotals; targets: Targets }) {
  const items = [
    { label: 'Protein', t: totals.protein, target: targets.protein },
    { label: 'Carbohydrate', t: totals.carbs, target: targets.carbs },
    { label: 'Fat', t: totals.fat, target: targets.fat },
  ];
  return (
    <section aria-label="Day totals" className={styles.totals}>
      <div className={styles.total}>
        <span className={styles.totalLabel}>Calories</span>
        <span className={styles.totalValue}>{formatInt(totals.calories)}</span>
        <span className={styles.totalNote}>
          {targets.calories !== null ? `kcal of ${formatInt(targets.calories)} target` : 'kcal recorded'}
        </span>
      </div>
      {items.map(({ label, t, target }) => {
        const note = macroNote(t, totals.entryCount);
        return (
          <div className={styles.total} key={label}>
            <span className={styles.totalLabel}>{label}</span>
            <span className={styles.totalValue}>{t.recordedCount === 0 ? '—' : `${formatOne(t.total)} g`}</span>
            <span className={styles.totalNote}>{note ?? (target !== null ? `of ${formatInt(target)} g target` : 'grams recorded')}</span>
          </div>
        );
      })}
    </section>
  );
}
