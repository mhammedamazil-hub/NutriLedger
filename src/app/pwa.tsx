import { useCallback, useMemo, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { PwaContext, type PwaStatus } from './pwaContext';


/**
 * Registers the Workbox service worker (production builds only). New versions
 * wait until the user chooses "Reload to update", which activates the new
 * worker and reloads once — so a running tab never mixes old and new assets.
 * IndexedDB records are untouched by updates.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for updates when the app regains focus (no background polling).
      if (!registration) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) void registration.update().catch(() => undefined);
      });
    },
    onRegisterError() {
      // Service workers can be unavailable (e.g. private mode, http). The app still works online.
    },
  });

  const dismissOfflineReady = useCallback(() => setOfflineReady(false), [setOfflineReady]);
  const value = useMemo<PwaStatus>(
    () => ({ needRefresh, offlineReady, update: () => updateServiceWorker(true), dismissOfflineReady }),
    [needRefresh, offlineReady, updateServiceWorker, dismissOfflineReady],
  );
  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}
