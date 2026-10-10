import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatInt } from '../../lib/formatting/numbers';
import chartStyles from './ChartFrame.module.css';

export interface CaloriePoint {
  key: string;
  label: string;
  /** Long label for tooltips. */
  fullLabel: string;
  calories: number | null;
  entryCount: number;
}

interface TooltipArgs {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CaloriePoint }>;
}

function CalorieTooltip({ active, payload }: TooltipArgs) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className={chartStyles.tooltip}>
      <strong>{p.fullLabel}</strong>
      {p.calories === null ? (
        <span>Not logged</span>
      ) : (
        <>
          <span>{formatInt(p.calories)} kcal recorded</span>
          <span className="muted">
            {p.entryCount} {p.entryCount === 1 ? 'entry' : 'entries'}
          </span>
        </>
      )}
    </div>
  );
}

/** Daily (or aggregated) recorded calories. Null values render as gaps, never as zero bars. */
export function CalorieBarChart({ data, target }: { data: CaloriePoint[]; target: number | null }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--c-chart-grid)" />
        <XAxis dataKey="label" tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis width={44} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatInt(v)} />
        <Tooltip content={<CalorieTooltip />} cursor={{ fill: 'var(--c-surface-2)' }} />
        {target !== null && (
          <ReferenceLine y={target} stroke="var(--c-chart-target)" strokeDasharray="5 4" ifOverflow="extendDomain" />
        )}
        <Bar dataKey="calories" fill="var(--c-chart-cal)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
