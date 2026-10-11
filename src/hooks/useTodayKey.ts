import { useEffect, useState } from 'react';
import { todayKey } from '../lib/formatting/dates';

/** Today's local day key; updates at local midnight and when the app regains focus. */
export function useTodayKey(): string {
  const [key, setKey] = useState(() => todayKey());
  useEffect(() => {
    const refresh = () => setKey(todayKey());
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [key]);
  return key;
}
