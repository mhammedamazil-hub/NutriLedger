import type { ReactNode } from 'react';
import type { DataStore } from './dataStore';
import { DataStoreContext } from './dataContext';

export function DataStoreProvider({ store, children }: { store: DataStore; children: ReactNode }) {
  return <DataStoreContext.Provider value={store}>{children}</DataStoreContext.Provider>;
}
