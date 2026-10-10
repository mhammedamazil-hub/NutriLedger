import { createContext, useContext } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastApi {
  show: (message: string, options?: { tone?: 'default' | 'error'; action?: ToastAction; durationMs?: number }) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/** At most this many toasts are visible, so on small phones they never cover most of the screen. */
export const MAX_VISIBLE_TOASTS = 2;

/**
 * Adds a toast, trimming to `max`. The oldest toast *without* an action is
 * dropped first, so an "Undo" toast is not pushed away by later confirmations.
 */
export function pushToast<T extends { action?: unknown }>(list: readonly T[], item: T, max = MAX_VISIBLE_TOASTS): T[] {
  const next = [...list, item];
  while (next.length > max) {
    const i = next.findIndex((t, idx) => idx < next.length - 1 && !t.action);
    next.splice(i === -1 ? 0 : i, 1);
  }
  return next;
}
