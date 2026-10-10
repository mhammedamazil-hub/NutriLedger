import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import chartStyles from './ChartFrame.module.css';

export interface LinePoint {
  key: string;
  /** Milliseconds since epoch (local midnight) so spacing reflects real time gaps. */
  t: number;
  fullLabel: string;
  [series: string]: number | string | null;
}

interface SeriesDef {
  dataKey: string;
  name: string;
  color: string;
  format: (v: number) => string;
}

interface TooltipArgs {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: LinePoint }>;
  series: SeriesDef[];
}

function LineTooltip({ active, payload, series }: TooltipArgs) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className={chartStyles.tooltip}>
      <strong>{p.fullLabel}</strong>
      {series.map((s) => {
        const v = p[s.dataKey];
        return typeof v === 'number' ? (
          <span key={s.dataKey}>
            {s.name}: {s.format(v)}
          </span>
        ) : null;
      })}
    </div>
  );
}

const tickFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/** Time-scaled line chart. Points are connected straight (no smoothing) and never extrapolated. */
export function LineSeriesChart({
  data,
  series,
  yFormat,
  yDomain,
}: {
  data: LinePoint[];
  series: SeriesDef[];
  yFormat: (v: number) => string;
  yDomain?: [number | 'auto' | 'dataMin', number | 'auto' | 'dataMax'];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--c-chart-grid)" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v: number) => tickFmt.format(new Date(v))}
          tickLine={false}
          minTickGap={24}
          padding={{ left: 12, right: 12 }}
        />
        <YAxis width={48} tickLine={false} axisLine={false} tickFormatter={yFormat} domain={yDomain ?? ['auto', 'auto']} />
        <Tooltip content={<LineTooltip series={series} />} />
        {series.map((s) => (
          <Line
            key={s.dataKey}
            type="linear"
            dataKey={s.dataKey}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color }}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
