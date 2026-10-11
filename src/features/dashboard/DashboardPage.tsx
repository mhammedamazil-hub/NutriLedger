import { useMemo } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { buttonClass } from '../../components/common/buttonClass';
import { useData } from '../../app/dataContext';
import { useTodayKey } from '../../hooks/useTodayKey';
import { useDayEntries, useProfileEstimate } from '../../hooks/useDerived';
import { totalsFor } from '../../lib/calculations/nutrition';
import { formatDayLong } from '../../lib/formatting/dates';
import { GettingStarted } from './GettingStarted';
import { IntakePanel } from './IntakePanel';
import { MacroPanel } from './MacroPanel';
import { MealBreakdown } from './MealBreakdown';
import { EnergyPanel } from './EnergyPanel';
import { WeekChart } from './WeekChart';
import { RecentEntries } from './RecentEntries';
import { WeightSnapshot } from './WeightSnapshot';
import styles from './Dashboard.module.css';

/** Today's summary. Every figure is derived from saved records; nothing is invented. */
export function DashboardPage() {
  const today = useTodayKey();
  const entries = useDayEntries(today);
  const totals = useMemo(() => totalsFor(entries), [entries]);
  const targets = useData((s) => s.targets);
  const allEntries = useData((s) => s.foodEntries);
  const weights = useData((s) => s.weights);
  const estimate = useProfileEstimate();

  const hasAnyData = allEntries.length > 0 || weights.length > 0;
  const showGettingStarted = !hasAnyData || estimate.status === 'incomplete' || targets.calories === null;

  return (
    <>
      <PageHeader
        eyebrow={formatDayLong(today)}
        title="Today"
        documentTitle="Dashboard"
        actions={
          <Link to={`/diary?date=${today}&add=1`} className={buttonClass('primary')}>
            <Plus aria-hidden="true" width={18} height={18} />
            Add food
          </Link>
        }
      />

      {showGettingStarted && (
        <GettingStarted
          profileDone={estimate.status !== 'incomplete'}
          targetDone={targets.calories !== null}
          loggedDone={allEntries.length > 0}
          today={today}
        />
      )}

      <div className={styles.grid}>
        <div className={styles.span7}>
          <IntakePanel totals={totals} targets={targets} today={today} />
        </div>
        <div className={styles.span5}>
          <MacroPanel totals={totals} targets={targets} />
        </div>
        <div className={styles.span6}>
          <EnergyPanel intake={totals.calories} entryCount={totals.entryCount} estimate={estimate} />
        </div>
        <div className={styles.span6}>
          <MealBreakdown entries={entries} today={today} />
        </div>
        <div className={styles.span8}>
          <WeekChart today={today} target={targets.calories} />
        </div>
        <div className={styles.span4}>
          <div className="stack">
            <RecentEntries />
            <WeightSnapshot />
          </div>
        </div>
      </div>
    </>
  );
}
