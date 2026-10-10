import { useMemo } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/common/Panel';
import { EmptyState } from '../../components/feedback/EmptyState';
import { groupByMeal, sumCalories } from '../../lib/calculations/nutrition';
import { mealLabel, orderedMeals } from '../../lib/meals';
import { formatInt, pluralize } from '../../lib/formatting/numbers';
import { useData } from '../../app/dataContext';
import type { FoodEntry } from '../../types/models';
import styles from './Dashboard.module.css';

export function MealBreakdown({ entries, today }: { entries: FoodEntry[]; today: string }) {
  const customMeals = useData((s) => s.customMeals);
  const rows = useMemo(() => {
    const byMeal = groupByMeal(entries);
    return orderedMeals(customMeals, byMeal.keys())
      .filter((m) => byMeal.has(m))
      .map((m) => {
        const list = byMeal.get(m) ?? [];
        return { meal: m, count: list.length, calories: sumCalories(list) };
      });
  }, [entries, customMeals]);

  return (
    <Panel
      title="By meal"
      titleId="meal-title"
      actions={
        entries.length > 0 ? (
          <Link to={`/diary?date=${today}`} className="small" style={{ fontWeight: 600 }}>
            Open diary
          </Link>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyState compact title="No meals logged today">
          Entries you add to Breakfast, Lunch, Dinner, Snacks or your own meal labels will be summarised here.
        </EmptyState>
      ) : (
        <ul className={styles.mealList}>
          {rows.map((r) => (
            <li key={r.meal}>
              <span>
                <span className={styles.mealName}>{mealLabel(r.meal)}</span>{' '}
                <span className="muted">· {pluralize(r.count, 'entry', 'entries')}</span>
              </span>
              <span className={styles.mealValue}>{formatInt(r.calories)} kcal</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
