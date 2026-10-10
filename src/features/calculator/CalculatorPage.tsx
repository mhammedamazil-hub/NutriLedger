import { PageHeader } from '../../components/layout/PageHeader';
import { ProfileForm } from './ProfileForm';
import { ResultsPanel } from './ResultsPanel';
import { AssessmentHistory } from './AssessmentHistory';
import styles from './Calculator.module.css';

export default function CalculatorPage() {
  return (
    <>
      <PageHeader
        title="Energy calculator"
        description="Estimate resting (BMR) and total daily energy expenditure (TDEE). Calculated on this device; nothing is sent anywhere."
      />
      <div className={styles.layout}>
        <ProfileForm />
        <div className={`stack ${styles.sticky}`}>
          <ResultsPanel />
        </div>
      </div>
      <div style={{ marginTop: 'var(--space-5)' }}>
        <AssessmentHistory />
      </div>
    </>
  );
}
