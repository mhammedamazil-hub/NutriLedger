import { createContext, useContext } from 'react';

export interface PwaStatus {
  needRefresh: boolean;
  offlineReady: boolean;
  update: () => Promise<void>;
  dismissOfflineReady: () => void;
}

const noop: PwaStatus = {
  needRefresh: false,
  offlineReady: false,
  update: async () => undefined,
  dismissOfflineReady: () => undefined,
};

export const PwaContext = createContext<PwaStatus>(noop);

export const usePwaStatus = (): PwaStatus => useContext(PwaContext);
