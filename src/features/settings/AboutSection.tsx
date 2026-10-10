import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { useToast } from '../../components/feedback/toastContext';
import { preferencesStore } from '../../app/preferences';
import styles from './Settings.module.css';

export function PrivacySection() {
  return (
    <Panel title="Privacy" titleId="privacy" as="section">
      <div className={styles.prose}>
        <ul>
          <li>NutriLedger has no accounts, no server, no analytics and no trackers.</li>
          <li>Your records are stored only in this browser (IndexedDB). Small preferences are kept in local storage.</li>
          <li>Nothing leaves your device unless you use an AI feature with your own Gemini key, and each AI tool shows exactly what it will send before you send it.</li>
          <li>Exports are created locally and downloaded straight to your device.</li>
          <li>NutriLedger is a tracking tool, not medical advice. Estimates are approximate. If you have a medical condition, are pregnant, or have a history of disordered eating, please work with a qualified professional.</li>
        </ul>
      </div>
    </Panel>
  );
}

export function AboutSection() {
  const toast = useToast();
  return (
    <Panel title="About" titleId="about" as="section">
      <div className="stack">
        <dl className={styles.dl}>
          <dt>App</dt>
          <dd>NutriLedger — Nutrition, measured clearly.</dd>
          <dt>Version</dt>
          <dd>{__APP_VERSION__}</dd>
        </dl>
        <div className={styles.prose}>
          <p>
            <strong>Equations and sources</strong>
          </p>
          <ul>
            <li>BMR: Mifflin MD, St Jeor ST, et al. “A new predictive equation for resting energy expenditure in healthy individuals.” Am J Clin Nutr. 1990;51(2):241–247.</li>
            <li>Lean-mass BMR: Katch–McArdle equation, 370 + 21.6 × lean body mass (kg) (McArdle, Katch &amp; Katch, Exercise Physiology).</li>
            <li>Body fat: US Navy circumference method, Hodgdon JA, Beckett MB. Naval Health Research Center reports 84-11 and 84-29 (1984), metric (cm) form.</li>
            <li>Activity multipliers 1.2 / 1.375 / 1.55 / 1.725 / 1.9 are widely used population-level factors, not individual measurements.</li>
          </ul>
          <p className="muted">Food nutrition values are whatever you enter or confirm. NutriLedger does not include a food database.</p>
        </div>
        <div>
          <Button
            size="sm"
            onClick={() => {
              preferencesStore.reset();
              toast.show('Preferences reset to defaults (theme, units, AI model). Your records were not changed.');
            }}
          >
            Reset preferences
          </Button>
        </div>
      </div>
    </Panel>
  );
}
