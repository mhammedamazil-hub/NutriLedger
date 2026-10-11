import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './Toast.module.css';
import { pushToast, ToastContext, type ToastAction, type ToastApi } from './toastContext';


interface ToastItem {
  id: number;
  message: string;
  tone: 'default' | 'error';
  action?: ToastAction | undefined;
}


export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const show = useCallback<ToastApi['show']>(
    (message, options = {}) => {
      const id = nextId.current++;
      // Keep at most two visible; prefer keeping toasts that offer an action (e.g. Undo).
      setItems((list) => pushToast(list, { id, message, tone: options.tone ?? 'default', action: options.action }));
      const duration = options.durationMs ?? (options.action ? 8000 : 4500);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} className={`${styles.toast} ${t.tone === 'error' ? styles.error : ''}`}>
            <span className={styles.message}>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className={styles.action}
                // Visible text stays short ("Undo"); the accessible name says what it undoes,
                // so several action toasts are never ambiguous for screen-reader users.
                aria-label={`${t.action.label}: ${t.message}`}
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className={styles.close} onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
