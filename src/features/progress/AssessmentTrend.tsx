import { useMemo } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/common/Panel';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ChartFrame, LegendItem } from '../../components/charts/ChartFrame';
import type { LinePoint } from '../../components/charts/LineSeriesChart';
import { LineSeriesChart } from '../../components/charts/lazy';
import { useData } from '../../app/dataContext';
import { formatDayMedium, parseDayKey } from '../../lib/formatting/dates';
import { formatInt, formatOne } from '../../lib/formatting/numbers';

export function AssessmentTrend({ start, today }: { start: string; today: string }) {
  const assessments = useData((s) => s.assessments);
  const inRange = useMemo(
    () =>
      assessments
        .filter((a) => a.date >= start && a.date <= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    [assessments, start, today],
  );
  const data: LinePoint[] = inRange.map((a) => ({
    key: a.id,
    t: parseDayKey(a.date).getTime(),
    fullLabel: formatDayMedium(a.date),
    bmr: Math.round(a.results.bmr),
    tdee: Math.round(a.results.tdee),
    bodyFat: a.results.bodyFatPercent === null ? null : Math.round(a.results.bodyFatPercent * 10) / 10,
  }));
  const anyBodyFat = data.some((d) => d.bodyFat !== null);

  return (
    <Panel title="Saved assessments" titleId="assessment-section" description="BMR and TDEE estimates from assessments you saved in the calculator.">
      {assessments.length === 0 ? (
        <EmptyState compact title="No saved assessments" action={<Link to="/calculator">Open calculator</Link>}>
          Save an assessment in the calculator to track how your estimates change.
        </EmptyState>
      ) : inRange.length === 0 ? (
        <EmptyState compact title="No assessments in this range">
          Choose a longer range to see older assessments.
        </EmptyState>
      ) : (
        <div className="stack">
          <ChartFrame
            label="Assessment chart"
            height={220}
            summary={<>{inRange.length === 1 ? 'One assessment in this range.' : `${inRange.length} assessments in this range.`} Values are estimates, not measurements.</>}
            legend={
              <>
                <LegendItem color="var(--c-chart-cal)">TDEE</LegendItem>
                <LegendItem color="var(--c-chart-protein)">BMR</LegendItem>
              </>
            }
            rows={[...data].reverse()}
            rowKey={(r) => r.key}
            columns={[
              { header: 'Date', cell: (r) => r.fullLabel },
              { header: 'BMR kcal', cell: (r) => formatInt(Number(r.bmr)) },
              { header: 'TDEE kcal', cell: (r) => formatInt(Number(r.tdee)) },
              { header: 'Body fat %', cell: (r) => (typeof r.bodyFat === 'number' ? formatOne(r.bodyFat) : '—') },
            ]}
          >
            <LineSeriesChart
              data={data}
              yFormat={(v) => formatInt(v)}
              series={[
                { dataKey: 'tdee', name: 'TDEE', color: 'var(--c-chart-cal)', format: (v) => `${formatInt(v)} kcal` },
                { dataKey: 'bmr', name: 'BMR', color: 'var(--c-chart-protein)', format: (v) => `${formatInt(v)} kcal` },
              ]}
            />
          </ChartFrame>
          {anyBodyFat && (
            <ChartFrame
              label="Body-fat chart"
              height={180}
              summary={<>US Navy body-fat estimates from assessments that included measurements.</>}
              legend={<LegendItem color="var(--c-chart-fat)">Body fat %</LegendItem>}
              rows={[...data].filter((d) => d.bodyFat !== null).reverse()}
              rowKey={(r) => r.key}
              columns={[
                { header: 'Date', cell: (r) => r.fullLabel },
                { header: 'Body fat %', cell: (r) => formatOne(Number(r.bodyFat)) },
              ]}
            >
              <LineSeriesChart
                data={data.filter((d) => d.bodyFat !== null)}
                yFormat={(v) => `${formatOne(v)}%`}
                series={[{ dataKey: 'bodyFat', name: 'Body fat', color: 'var(--c-chart-fat)', format: (v) => `${formatOne(v)}%` }]}
              />
            </ChartFrame>
          )}
        </div>
      )}
    </Panel>
  );
}
