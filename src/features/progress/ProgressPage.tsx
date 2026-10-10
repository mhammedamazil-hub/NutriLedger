import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { Segmented } from '../../components/forms/Field';
import { useData } from '../../app/dataContext';
import { useTodayKey } from '../../hooks/useTodayKey';
import { formatDayMedium } from '../../lib/formatting/dates';
import { RANGES, RANGE_LABELS, rangeDays, type RangeKey } from './series';
import { WeightSection } from './WeightSection';
import { IntakeSection } from './IntakeSection';
import { AssessmentTrend } from './AssessmentTrend';
import styles from './Progress.module.css';

const isRange = (v: string | null): v is RangeKey => v !== null && (RANGES as readonly string[]).includes(v);

export default function ProgressPage() {
  const today = useTodayKey();
  const [params, setParams] = useSearchParams();
  const raw = params.get('range');
  const range: RangeKey = isRange(raw) ? raw : '30d';
  const entries = useData((s) => s.foodEntries);
  const weights = useData((s) => s.weights);
  const assessments = useData((s) => s.assessments);

  const earliest = useMemo(() => {
    let min: string | null = null;
    for (const list of [entries, weights, assessments]) for (const r of list) if (min === null || r.date < min) min = r.date;
    return min;
  }, [entries, weights, assessments]);

  const days = useMemo(() => rangeDays(range, today, earliest), [range, today, earliest]);
  const start = days[0] ?? today;

  return (
    <>
      <PageHeader title="Progress" description="Trends from your own records only. Missing days stay missing; nothing is estimated to fill gaps." />
      <div className={styles.sections}>
        <div className={styles.rangeBar}>
          <Segmented
            legend="Time range"
            hideLegend
            name="range"
            value={range}
            onChange={(r) =>
              setParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('range', r);
                  return next;
                },
                { replace: true },
              )
            }
            options={RANGES.map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
          />
          <span className="small muted">
            {formatDayMedium(start)} – {formatDayMedium(today)}
          </span>
        </div>
        <IntakeSection days={days} />
        <WeightSection start={start} today={today} rangeLabel={RANGE_LABELS[range]} />
        <AssessmentTrend start={start} today={today} />
      </div>
    </>
  );
}
