import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { AppearanceSection } from './AppearanceSection';
import { TargetsSection } from './TargetsSection';
import { MealsSection } from './MealsSection';
import { AiKeySection } from './AiKeySection';
import { DataSection } from './DataSection';
import { InstallSection } from './InstallSection';
import { AboutSection, PrivacySection } from './AboutSection';
import styles from './Settings.module.css';

const SECTIONS = [
  ['appearance', 'Appearance'],
  ['targets', 'Targets'],
  ['meals', 'Custom meals'],
  ['ai', 'AI assistant'],
  ['data', 'Your data'],
  ['install', 'Install'],
  ['privacy', 'Privacy'],
  ['about', 'About'],
] as const;

export default function SettingsPage() {
  const { hash } = useLocation();

  // Support deep links such as /settings#targets.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      el.scrollIntoView({ block: 'start' });
      const section = el.closest('section');
      const heading = section?.querySelector<HTMLElement>('h2');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }, [hash]);

  return (
    <>
      <PageHeader title="Settings" description="Preferences, targets, optional AI, and your data." />
      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="Settings sections">
          <ul>
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sections}>
          <AppearanceSection />
          <TargetsSection />
          <MealsSection />
          <AiKeySection />
          <DataSection />
          <InstallSection />
          <PrivacySection />
          <AboutSection />
        </div>
      </div>
    </>
  );
}
