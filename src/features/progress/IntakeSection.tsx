import { useMemo } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/common/Panel';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ChartFrame, LegendItem } from '../../components/charts/ChartFrame';
import type { CaloriePoint } from '../../components/charts/CalorieBarChart';
import { CalorieBarChart } from '../../components/charts/lazy';
import type { MacroPoint } from '../../components/charts/MacroStackChart';
import { MacroStackChart } from '../../components/charts/lazy';
import { useData } from '../../app/dataContext';
import { averageLoggedCalories, dailySeries } from '../../lib/calculations/nutrition';
import { formatDayMedium, formatDayShort, formatWeekday } from '../../lib/formatting/dates';
import { formatInt, formatOne } from '../../lib/formatting/numbers';
import { DAILY_LIMIT, weeklyBuckets } from './series';
import styles from './Progress.module.css';

const g = (n: number | null) => (n === null ? '—' : formatOne(n));

export function IntakeSection({ days }: { days: string[] }) {
  const entries = useData((s) => s.foodEntries);
  const target = useData((s) => s.targets.calories);
  const daily = useMemo(() => dailySeries(entries, days), [entries, days]);
  const weekly = days.length > DAILY_LIMIT;
  const loggedDays = daily.filter((p) => p.calories !== null).length;
  const avg = averageLoggedCalories(daily);

  const { calorieData, macroData } = useMemo(() => {
    if (weekly) {
      const buckets = weeklyBuckets(daily);
      const label = (s: string, e: string) => `${formatDayMedium(s)} – ${formatDayMedium(e)}`;
      return {
        calorieData: buckets.map<CaloriePoint>((b) => ({
          key: b.start,
          label: formatDayShort(b.start),
          fullLabel: `${label(b.start, b.end)} (avg of ${b.loggedDays}/${b.totalDays} logged days)`,
          calories: b.calories,
          entryCount: b.entryCount,
        })),
        macroData: buckets.map<MacroPoint>((b) => ({
          key: b.start,
          label: formatDayShort(b.start),
          fullLabel: `${label(b.start, b.end)} (daily average)`,
          protein: b.protein,
          carbs: b.carbs,
          fat: b.fat,
          incomplete: b.macrosIncomplete,
        })),
      };
    }
    const lbl = (d: string) => (days.length <= 7 ? formatWeekday(d) : formatDayShort(d));
    return {
      calorieData: daily.map<CaloriePoint>((p) => ({
        key: p.date,
        label: lbl(p.date),
        fullLabel: formatDayMedium(p.date),
        calories: p.calories,
        entryCount: p.entryCount,
      })),
      macroData: daily.map<MacroPoint>((p) => ({
        key: p.date,
        label: lbl(p.date),
        fullLabel: formatDayMedium(p.date),
        protein: p.protein,
        carbs: p.carbs,
        fat: p.fat,
        incomplete: p.macrosIncomplete,
      })),
    };
  }, [daily, days, weekly]);

  if (loggedDays === 0) {
    return (
      <Panel title="Intake" titleId="intake-section">
        <EmptyState compact title="No food logged in this range" action={<Link to="/diary?add=1">Add food</Link>}>
          Charts appear once you log food. Days without entries are shown as gaps, never as zero.
        </EmptyState>
      </Panel>
    );
  }

  const anyMacros = daily.some((p) => p.protein !== null || p.carbs !== null || p.fat !== null);
  const period = weekly ? 'Weekly averages of logged days' : 'Daily totals';

  return (
    <div className={styles.twoCol}>
      <Panel title="Calories" titleId="intake-section" description={period}>
        <div className="stack">
          <div className={styles.stats}>
            <span>
              Logged <strong>{loggedDays}</strong> of {days.length} days
            </span>
            {avg !== null && (
              <span>
                Average on logged days <strong>{formatInt(avg)}</strong> kcal
              </span>
            )}
          </div>
          <ChartFrame
            label="Calorie chart"
            height={240}
            summary={
              <>
                {period}. Unlogged {weekly ? 'weeks' : 'days'} appear as gaps.
                {weekly && ' Ranges longer than 90 days are grouped by week to stay readable.'}
              </>
            }
            legend={
              <>
                <LegendItem color="var(--c-chart-cal)">{weekly ? 'Avg kcal per logged day' : 'Recorded kcal'}</LegendItem>
                {target !== null && <LegendItem dashed>Target ({formatInt(target)} kcal)</LegendItem>}
              </>
            }
            rows={[...calorieData].reverse()}
            rowKey={(r) => r.key}
            columns={[
              { header: weekly ? 'Week' : 'Date', cell: (r) => r.fullLabel },
              { header: weekly ? 'Avg kcal' : 'kcal', cell: (r) => (r.calories === null ? 'Not logged' : formatInt(r.calories)) },
              { header: 'Entries', cell: (r) => r.entryCount },
            ]}
          >
            <CalorieBarChart data={calorieData} target={target} />
          </ChartFrame>
        </div>
      </Panel>

      <Panel title="Macronutrients" titleId="macro-section" description={`${period}, grams`}>
        {anyMacros ? (
          <ChartFrame
            label="Macronutrient chart"
            height={240}
            summary={<>Protein, carbohydrate and fat recorded. Entries without macro values are excluded, not counted as zero.</>}
            legend={
              <>
                <LegendItem color="var(--c-chart-protein)">Protein</LegendItem>
                <LegendItem color="var(--c-chart-carbs)">Carbohydrate</LegendItem>
                <LegendItem color="var(--c-chart-fat)">Fat</LegendItem>
              </>
            }
            rows={[...macroData].reverse()}
            rowKey={(r) => r.key}
            columns={[
              { header: weekly ? 'Week' : 'Date', cell: (r) => r.fullLabel },
              { header: 'Protein g', cell: (r) => g(r.protein) },
              { header: 'Carbs g', cell: (r) => g(r.carbs) },
              { header: 'Fat g', cell: (r) => g(r.fat) },
              { header: 'Complete', cell: (r) => (r.protein === null && r.carbs === null && r.fat === null ? '—' : r.incomplete ? 'Partial' : 'Yes') },
            ]}
          >
            <MacroStackChart data={macroData} />
          </ChartFrame>
        ) : (
          <EmptyState compact title="No macros recorded in this range">
            Add protein, carbohydrate and fat to diary entries to see trends here.
          </EmptyState>
        )}
      </Panel>
    </div>
  );
}
