import { useEffect } from 'react';
import { useDataStore, useData } from './dataContext';
import { useApplyTheme } from './theme';
import { AppRoutes } from './router';

/** Root component: applies the theme, starts storage, renders routes. */
export function App() {
  useApplyTheme();
  const store = useDataStore();
  const status = useData((s) => s.status);

  useEffect(() => {
    void store.init();
  }, [store]);

  if (status === 'loading') {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <p className="muted" role="status">
          Opening your records…
        </p>
      </div>
    );
  }
  return <AppRoutes />;
}
