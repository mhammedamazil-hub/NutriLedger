import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { Panel } from '../../components/common/Panel';
import styles from './Dashboard.module.css';

interface Props {
  profileDone: boolean;
  targetDone: boolean;
  loggedDone: boolean;
  today: string;
}

/** Shown to new users or when key setup is incomplete. Reflects real saved state only. */
export function GettingStarted({ profileDone, targetDone, loggedDone, today }: Props) {
  const steps = [
    {
      done: profileDone,
      title: 'Estimate your energy needs',
      text: 'Enter age, height, weight and activity to get BMR and TDEE estimates.',
      link: { to: '/calculator', label: profileDone ? 'Review calculator' : 'Open calculator' },
    },
    {
      done: targetDone,
      title: 'Set a daily target (optional)',
      text: 'Use your TDEE estimate or enter your own calorie and macro targets.',
      link: { to: '/settings#targets', label: targetDone ? 'Edit targets' : 'Set targets' },
    },
    {
      done: loggedDone,
      title: 'Log what you eat',
      text: 'Record foods with your own nutrition values. Totals update instantly.',
      link: { to: `/diary?date=${today}&add=1`, label: 'Add a food' },
    },
  ];
  return (
    <Panel title="Get started" titleId="getting-started" description="Three short steps. Everything stays on this device.">
      <ol className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s.title} className={styles.step}>
            <span className={styles.stepHead}>
              <span className={`${styles.stepNum} ${s.done ? styles.stepDone : ''}`}>
                {s.done ? <Check aria-hidden="true" /> : i + 1}
              </span>
              {s.title}
              {s.done && <span className="visually-hidden"> (done)</span>}
            </span>
            <span className="small muted">{s.text}</span>
            <Link to={s.link.to} className="small tap-link">
              {s.link.label}
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
