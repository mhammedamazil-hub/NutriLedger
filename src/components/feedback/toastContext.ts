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
