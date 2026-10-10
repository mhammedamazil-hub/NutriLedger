import { createContext, useContext, useSyncExternalStore } from 'react';
import type { DataState, DataStore } from './dataStore';

export const DataStoreContext = createContext<DataStore | null>(null);

export function useDataStore(): DataStore {
  const store = useContext(DataStoreContext);
  if (!store) throw new Error('useDataStore must be used inside DataStoreProvider');
  return store;
}

/**
 * Subscribes to one slice of the data state. The selector must return a
 * value that is referentially stable while unchanged (e.g. `s => s.foodEntries`),
 * so components re-render only when their slice changes.
 */
export function useData<T>(selector: (state: DataState) => T): T {
  const store = useDataStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
