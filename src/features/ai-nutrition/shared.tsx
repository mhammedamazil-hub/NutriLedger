import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/common/Button';
import { Notice } from '../../components/feedback/Notice';
import type { AiRequestState } from '../../hooks/useAiRequest';
import styles from './Ai.module.css';

/** "Sends:" disclosure showing exactly what leaves the device. */
export function SendsDisclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className={styles.sends}>
      <summary>What will be sent: {summary}</summary>
      {children}
    </details>
  );
}

export function Payload({ text }: { text: string }) {
  return <pre className={styles.payload}>{text}</pre>;
}

/** Loading / cancel / error / retry UI shared by every tool. */
export function RequestStatus<T>({
  state,
  onCancel,
  onRetry,
  loadingLabel,
}: {
  state: AiRequestState<T>;
  onCancel: () => void;
  onRetry?: (() => void) | undefined;
  loadingLabel: string;
}) {
  if (state.status === 'loading') {
    return (
      <div className={styles.loading} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        <span>{loadingLabel}</span>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    );
  }
  if (state.status === 'error') {
    const needsSettings = ['missing-key', 'invalid-key', 'permission', 'model-unavailable'].includes(state.error.kind);
    return (
      <Notice tone="danger" role="alert" title="Request failed">
        {state.error.message}{' '}
        {needsSettings && <Link to="/settings#ai">Open AI settings</Link>}
        {onRetry && !needsSettings && state.error.kind !== 'offline' && (
          <span style={{ display: 'block', marginTop: 'var(--space-2)' }}>
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          </span>
        )}
      </Notice>
    );
  }
  if (state.status === 'idle' && state.notice) {
    return (
      <p className="small muted" role="status">
        {state.notice}
      </p>
    );
  }
  return null;
}

export function SendButton({ ready, reason, loading, children, onClick, type = 'button' }: { ready: boolean; reason: string | null; loading: boolean; children: ReactNode; onClick?: () => void; type?: 'button' | 'submit' }) {
  return (
    <div className="stack-sm">
      <div>
        <Button variant="primary" type={type} onClick={onClick} disabled={!ready || loading} loading={loading}>
          {children}
        </Button>
      </div>
      {reason && <p className="small muted">{reason}</p>}
    </div>
  );
}
