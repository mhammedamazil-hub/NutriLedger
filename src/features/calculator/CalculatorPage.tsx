import { useEffect } from 'react';
import { ProfileForm } from './ProfileForm';
import { ResultsPanel } from './ResultsPanel';
import { AssessmentHistory } from './AssessmentHistory';
import styles from './Calculator.module.css';

const TITLE = 'Energy calculator';

/**
 * Asymmetric editorial layout on a 12-column grid (container queries, so it
 * responds to the space beside the sidebar rather than the viewport):
 * header title 8 cols / aside 4; form 7 cols, a deliberate empty gutter, then
 * a sticky 4-col readout. Every spacing value is a multiple of 8px.
 */
export default function CalculatorPage() {
  useEffect(() => {
    document.title = `${TITLE} · NutriLedger`;
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <p className={styles.eyebrow}>Energy · Mifflin–St Jeor</p>
          <h1 tabIndex={-1} className={styles.display}>
            {TITLE}
          </h1>
        </div>
        <p className={styles.headerAside}>
          Estimate what your body spends in a day: resting metabolism plus activity. Calculated on this device; nothing is
          sent anywhere.
        </p>
      </header>
      <div className={styles.body}>
        <ProfileForm />
        <div className={styles.readoutCol}>
          <ResultsPanel />
        </div>
      </div>
      <AssessmentHistory />
    </div>
  );
}
