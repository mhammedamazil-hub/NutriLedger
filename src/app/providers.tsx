import type { ReactNode } from 'react';
import { DataStoreProvider } from './DataContext';
import type { DataStore } from './dataStore';
import { ToastProvider } from '../components/feedback/Toast';

export function AppProviders({ store, children }: { store: DataStore; children: ReactNode }) {
  return (
    <DataStoreProvider store={store}>
      <ToastProvider>{children}</ToastProvider>
    </DataStoreProvider>
  );
}
