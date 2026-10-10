import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '../common/Button';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Called before closing via Escape/close button; return false to keep it open. */
  canClose?: () => boolean;
  /** Use alertdialog for destructive confirmations. */
  role?: 'dialog' | 'alertdialog';
  describedBy?: string;
}

/**
 * Wrapper around the native <dialog> element: it provides focus trapping,
 * Escape handling, inert background and top-layer rendering for free.
 * Focus returns to the previously focused element when it closes.
 */
export function Dialog({ open, title, onClose, children, footer, wide, canClose, role = 'dialog', describedBy }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  useEffect(() => {
    onCloseRef.current = onClose;
    canCloseRef.current = canClose;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (canCloseRef.current && !canCloseRef.current()) return;
      onCloseRef.current();
    };
    const handleClose = () => {
      const target = returnFocus.current;
      if (target && document.contains(target)) target.focus();
    };
    el.addEventListener('cancel', handleCancel);
    el.addEventListener('close', handleClose);
    return () => {
      el.removeEventListener('cancel', handleCancel);
      el.removeEventListener('close', handleClose);
    };
  }, []);

  const requestClose = () => {
    if (canClose && !canClose()) return;
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${wide ? styles.wide : ''}`}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
    >
      {open && (
        <>
          <div className={styles.header}>
            <h2 id={titleId}>{title}</h2>
            <Button variant="ghost" iconOnly icon={<X aria-hidden="true" />} aria-label="Close" onClick={requestClose} />
          </div>
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </>
      )}
    </dialog>
  );
}
