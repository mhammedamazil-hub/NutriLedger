import { useEffect } from 'react';
import { usePreferences } from './preferences';
import type { ThemePreference } from '../types/models';

const THEME_COLORS = { light: '#245B43', dark: '#101612' } as const;

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(pref: ThemePreference) {
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
}

/** Applies the theme preference to <html data-theme> and follows the OS in "system" mode. */
export function useApplyTheme() {
  const { theme } = usePreferences();
  useEffect(() => {
    apply(theme);
    if (theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [theme]);
}
