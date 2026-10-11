import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatOne } from '../../lib/formatting/numbers';
import chartStyles from './ChartFrame.module.css';

export interface MacroPoint {
  key: string;
  label: string;
  fullLabel: string;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  incomplete: boolean;
}

interface TooltipArgs {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: MacroPoint }>;
}

function MacroTooltip({ active, payload }: TooltipArgs) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const v = (n: number | null) => (n === null ? '—' : `${formatOne(n)} g`);
  return (
    <div className={chartStyles.tooltip}>
      <strong>{p.fullLabel}</strong>
      {p.protein === null && p.carbs === null && p.fat === null ? (
        <span>No macros recorded</span>
      ) : (
        <>
          <span>Protein {v(p.protein)}</span>
          <span>Carbohydrate {v(p.carbs)}</span>
          <span>Fat {v(p.fat)}</span>
          {p.incomplete && <span className="muted">Some entries did not record macros</span>}
        </>
      )}
    </div>
  );
}

export function MacroStackChart({ data }: { data: MacroPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--c-chart-grid)" />
        <XAxis dataKey="label" tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis width={44} tickLine={false} axisLine={false} unit=" g" />
        <Tooltip content={<MacroTooltip />} cursor={{ fill: 'var(--c-surface-2)' }} />
        <Bar dataKey="protein" stackId="m" fill="var(--c-chart-protein)" maxBarSize={40} isAnimationActive={false} />
        <Bar dataKey="carbs" stackId="m" fill="var(--c-chart-carbs)" maxBarSize={40} isAnimationActive={false} />
        <Bar dataKey="fat" stackId="m" fill="var(--c-chart-fat)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
