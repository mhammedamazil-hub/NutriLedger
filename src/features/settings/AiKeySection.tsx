import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { Checkbox, SelectField, TextField } from '../../components/forms/Field';
import { Notice } from '../../components/feedback/Notice';
import { useToast } from '../../components/feedback/toastContext';
import { preferencesStore, usePreferences } from '../../app/preferences';
import { keyStore, maskKey, useKeyState } from '../../lib/ai/keyStore';
import { SUPPORTED_MODELS } from '../../lib/ai/models';
import { AiError, AI_ERROR_MESSAGES } from '../../lib/ai/errors';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import styles from './Settings.module.css';

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

export function AiKeySection() {
  const keyState = useKeyState();
  const { aiModel } = usePreferences();
  const online = useOnlineStatus();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const saveKey = () => {
    const k = draft.trim();
    if (!k) return setError('Paste your API key first.');
    if (/\s/.test(k)) return setError('API keys do not contain spaces. Check what was pasted.');
    if (k.length < 20) return setError('That looks too short to be a Gemini API key.');
    keyStore.setKey(k, remember);
    setDraft('');
    setShow(false);
    setError(null);
    const stored = keyStore.get().remembered;
    toast.show(remember && !stored ? 'Key saved for this session only — this browser blocked device storage.' : remember ? 'Key saved on this device.' : 'Key saved for this session.');
  };

  const test = async () => {
    if (!keyState.apiKey || testing) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setTesting(true);
    const model = aiModel;
    try {
      const { testConnection } = await import('../../lib/ai/client');
      await testConnection({ apiKey: keyState.apiKey, model, signal: controller.signal, timeoutMs: 20_000 });
      keyStore.setTestResult({ status: 'success', message: 'Connected. The key works with the selected model.', at: new Date().toISOString(), model });
    } catch (err) {
      const kind = err instanceof AiError ? err.kind : 'unknown';
      if (kind === 'cancelled') return;
      keyStore.setTestResult({ status: 'failure', message: err instanceof AiError ? err.message : AI_ERROR_MESSAGES.unknown, at: new Date().toISOString(), model });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setTesting(false);
      }
    }
  };

  const remove = () => {
    abortRef.current?.abort();
    keyStore.clearKey();
    toast.show('API key removed from this browser.');
  };

  const selectedModel = SUPPORTED_MODELS.find((m) => m.id === aiModel);
  const last = keyState.lastTest;

  return (
    <Panel
      title="AI assistant (optional)"
      titleId="ai"
      as="section"
      description="AI features use your own Google Gemini API key and talk directly from this browser to Google. NutriLedger has no server."
    >
      <div className="stack">
        <div className={styles.status} role="status">
          <span className={`${styles.dot} ${keyState.apiKey ? (last?.status === 'failure' ? styles.dotWarn : styles.dotOk) : ''}`} aria-hidden="true" />
          {keyState.apiKey ? (
            <span>
              Key <code>{maskKey(keyState.apiKey)}</code> {keyState.remembered ? 'remembered on this device' : 'held in memory for this session only'}
              {last && last.model === aiModel && ` · last test ${last.status === 'success' ? 'succeeded' : 'failed'}`}
            </span>
          ) : (
            <span>No API key. All non-AI features work without one.</span>
          )}
        </div>

        {keyState.apiKey ? (
          <>
            {last && last.model === aiModel && (
              <Notice tone={last.status === 'success' ? 'success' : 'danger'} role="status">
                {last.message}
              </Notice>
            )}
            {!online && <Notice tone="warning">You are offline. Testing the connection needs internet access.</Notice>}
            <div className={styles.actions}>
              <Button onClick={() => void test()} loading={testing} disabled={!online}>
                Test connection
              </Button>
              {testing && (
                <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
                  Cancel test
                </Button>
              )}
              <Button variant="danger" onClick={remove}>
                Remove key
              </Button>
            </div>
            <p className="small muted">Testing looks up the selected model’s details with your key. No food data is sent.</p>
          </>
        ) : (
          <form
            className="stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              saveKey();
            }}
          >
            <TextField
              label="Gemini API key"
              type={show ? 'text' : 'password'}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              error={error ?? undefined}
              hint={
                <>
                  Create one in{' '}
                  <a href={AI_STUDIO_URL} target="_blank" rel="noopener noreferrer">
                    Google AI Studio
                  </a>{' '}
                  (opens in a new tab).
                </>
              }
            />
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShow((v) => !v)}
                icon={show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              >
                {show ? 'Hide key' : 'Show key'}
              </Button>
            </div>
            <Checkbox checked={remember} onChange={setRemember}>
              Remember this key on this device
            </Checkbox>
            {remember && (
              <Notice tone="warning" title="Stored unencrypted in this browser">
                The key will be saved in this browser’s local storage. It is not encrypted: anyone using this browser profile,
                or a malicious extension, could read it. Don’t use this on shared or public devices. You can remove it at any
                time here.
              </Notice>
            )}
            <div>
              <Button type="submit" variant="primary">
                Save key
              </Button>
            </div>
          </form>
        )}

        <SelectField
          label="Model"
          value={aiModel}
          onChange={(e) => preferencesStore.update({ aiModel: e.target.value })}
          hint={selectedModel?.note}
        >
          {SUPPORTED_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </SelectField>

        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 'var(--tap)', display: 'flex', alignItems: 'center', color: 'var(--c-primary)' }}>
            What is shared and what it costs
          </summary>
          <div className={styles.prose}>
            <ul>
              <li>Nothing is sent until you press a button in the AI section. Each tool shows exactly what it will send.</li>
              <li>Requests go from your browser to Google’s Gemini API under your key and Google’s terms. Usage counts toward your quota and may be billed if your project has billing enabled.</li>
              <li>Depending on your plan, Google may retain or use submitted content to improve its services. Check the Gemini API terms for your account.</li>
              <li>The key is never included in backups, exports, URLs or logs, and AI responses are never cached by the offline service worker.</li>
              <li>AI output can be wrong. Estimates are labelled “AI estimate — unverified” and are saved only after you review them.</li>
            </ul>
          </div>
        </details>
      </div>
    </Panel>
  );
}
