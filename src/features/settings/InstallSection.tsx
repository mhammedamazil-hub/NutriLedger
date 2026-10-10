import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { Notice } from '../../components/feedback/Notice';
import { useToast } from '../../components/feedback/toastContext';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { usePwaStatus } from '../../app/pwaContext';

export function InstallSection() {
  const { canPrompt, installed, promptInstall, isIos } = useInstallPrompt();
  const { offlineReady, needRefresh, update } = usePwaStatus();
  const toast = useToast();

  return (
    <Panel title="Install and offline use" titleId="install" as="section">
      <div className="stack">
        {installed ? (
          <Notice tone="success">NutriLedger is running as an installed app.</Notice>
        ) : canPrompt ? (
          <div className="stack-sm">
            <p className="small">Install NutriLedger for quick access from your home screen or dock. It works offline once installed.</p>
            <div>
              <Button
                variant="primary"
                onClick={async () => {
                  const outcome = await promptInstall();
                  if (outcome === 'accepted') toast.show('Installing NutriLedger…');
                }}
              >
                Install app
              </Button>
            </div>
          </div>
        ) : isIos ? (
          <div className="small stack-sm">
            <p>To install on iPhone or iPad:</p>
            <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
              <li>Open this page in Safari.</li>
              <li>Tap the Share button.</li>
              <li>Choose “Add to Home Screen”, then “Add”.</li>
            </ol>
          </div>
        ) : (
          <p className="small muted">
            Your browser hasn’t offered an install option. In Chrome or Edge, look for the install icon in the address bar or
            the browser menu (“Install NutriLedger” / “Add to Home screen”). Some browsers, such as Firefox on desktop, don’t
            support installing web apps.
          </p>
        )}
        <p className="small muted">
          {offlineReady
            ? 'This version is saved for offline use. The diary, calculator, progress and settings work without a connection; AI features need internet.'
            : 'After the first full load, the app is saved for offline use. AI features always need internet.'}
        </p>
        {needRefresh && (
          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span className="small">A new version is ready.</span>
            <Button size="sm" onClick={() => void update()}>
              Reload to update
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
