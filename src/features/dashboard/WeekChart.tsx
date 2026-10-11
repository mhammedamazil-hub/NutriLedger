import { useMemo } from 'react';
import { Panel } from '../../components/common/Panel';
import { ChartFrame, LegendItem } from '../../components/charts/ChartFrame';
import type { CaloriePoint } from '../../components/charts/CalorieBarChart';
import { CalorieBarChart } from '../../components/charts/lazy';
import { EmptyState } from '../../components/feedback/EmptyState';
import { useData } from '../../app/dataContext';
import { averageLoggedCalories, dailySeries } from '../../lib/calculations/nutrition';
import { formatDayMedium, formatWeekday, lastNDays } from '../../lib/formatting/dates';
import { formatInt } from '../../lib/formatting/numbers';

export function WeekChart({ today, target }: { today: string; target: number | null }) {
  const entries = useData((s) => s.foodEntries);
  const series = useMemo(() => dailySeries(entries, lastNDays(today, 7)), [entries, today]);
  const logged = series.filter((p) => p.calories !== null).length;
  const avg = averageLoggedCalories(series);
  const data: CaloriePoint[] = series.map((p) => ({
    key: p.date,
    label: formatWeekday(p.date),
    fullLabel: formatDayMedium(p.date),
    calories: p.calories,
    entryCount: p.entryCount,
  }));

  return (
    <Panel title="Last 7 days" titleId="week-title">
      {logged === 0 ? (
        <EmptyState compact title="No entries in the last 7 days">
          Once you log food, daily recorded calories appear here. Days without entries are shown as “not logged”, never as
          zero.
        </EmptyState>
      ) : (
        <ChartFrame
          label="Seven-day calorie chart"
          height={220}
          summary={
            <>
              Logged {logged} of 7 days{avg !== null ? `, averaging ${formatInt(avg)} kcal on logged days` : ''}. Days without
              entries are gaps, not zero.
            </>
          }
          legend={
            <>
              <LegendItem color="var(--c-chart-cal)">Recorded kcal</LegendItem>
              {target !== null && <LegendItem dashed>Daily target ({formatInt(target)} kcal)</LegendItem>}
            </>
          }
          rows={data}
          rowKey={(r) => r.key}
          columns={[
            { header: 'Date', cell: (r) => r.fullLabel },
            { header: 'Recorded kcal', cell: (r) => (r.calories === null ? 'Not logged' : formatInt(r.calories)) },
            { header: 'Entries', cell: (r) => r.entryCount },
          ]}
        >
          <CalorieBarChart data={data} target={target} />
        </ChartFrame>
      )}
    </Panel>
  );
}
