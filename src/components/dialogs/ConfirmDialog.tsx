import { useId, useState, type ReactNode } from 'react';
import { Button } from '../common/Button';
import { Dialog } from './Dialog';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  destructive?: boolean;
  /** If set, the user must type this word to enable the confirm button. */
  requireText?: string;
}

/** Explicit confirmation for irreversible actions. */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel, destructive, requireText }: Props) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const descId = useId();
  const inputId = useId();
  const enabled = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  const close = () => {
    if (busy) return;
    setTyped('');
    onCancel();
  };

  return (
    <Dialog
      open={open}
      title={title}
      onClose={close}
      canClose={() => !busy}
      role="alertdialog"
      describedBy={descId}
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={busy}
            disabled={!enabled}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setTyped('');
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div id={descId} className="stack">
        {children}
        {requireText && (
          <div className="stack-sm">
            <label htmlFor={inputId} className="small" style={{ fontWeight: 600 }}>
              Type {requireText} to confirm
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              style={{
                minHeight: 44,
                padding: '0 12px',
                borderRadius: 10,
                border: '1px solid var(--c-border-strong)',
                background: 'var(--c-surface)',
                fontSize: '1rem',
              }}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
