import { useMemo } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/common/Panel';
import { useData } from '../../app/dataContext';
import { formatInt } from '../../lib/formatting/numbers';
import { relativeDayLabel, formatDayMedium, daysBetween, todayKey } from '../../lib/formatting/dates';
import { mealLabel } from '../../lib/meals';
import styles from './Dashboard.module.css';

export function RecentEntries() {
  const entries = useData((s) => s.foodEntries);
  const recent = useMemo(
    () => [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [entries],
  );
  if (recent.length === 0) return null;
  const today = todayKey();
  return (
    <Panel title="Recently recorded" titleId="recent-title">
      <ul className={styles.recent}>
        {recent.map((e) => (
          <li key={e.id}>
            <Link to={`/diary?date=${e.date}`} className={styles.recentLink}>
              <span className={styles.recentMain}>
                <span className={styles.recentName}>{e.name}</span>
                <span className="muted small">
                  {mealLabel(e.meal)} ·{' '}
                  {Math.abs(daysBetween(today, e.date)) <= 1 ? relativeDayLabel(e.date, today) : formatDayMedium(e.date)}
                </span>
              </span>
              <span className="num" style={{ whiteSpace: 'nowrap' }}>
                {formatInt(e.calories)} kcal
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
