import { Link } from 'react-router';
import { PageHeader } from '../components/layout/PageHeader';
import { buttonClass } from '../components/common/buttonClass';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="This address doesn’t match any part of NutriLedger." />
      <div>
        <Link to="/" className={buttonClass('primary')}>
          Go to the dashboard
        </Link>
      </div>
    </>
  );
}
