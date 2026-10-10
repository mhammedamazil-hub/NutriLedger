import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { App } from '../app/App';
import { AppProviders } from '../app/providers';
import { DataStore } from '../app/dataStore';
import { createMemoryRepository } from '../lib/database/memory';
import type { DataSnapshot, Repository } from '../lib/database/types';
import { emptySnapshot } from '../lib/database/snapshot';

const stores: DataStore[] = [];

/** Disposes every store created by renderApp (call from afterEach). */
export function disposeStores() {
  while (stores.length) stores.pop()?.dispose();
}

/**
 * Renders the real application (router, providers, pages) against an
 * in-memory repository, starting at `path`. PwaProvider is omitted; its
 * context defaults to a no-op so the app runs without a service worker.
 */
export function renderApp(path = '/', options: { seed?: Partial<DataSnapshot>; repository?: Repository; failStorage?: boolean } = {}) {
  const repo = options.repository ?? createMemoryRepository({ ...emptySnapshot(), ...options.seed });
  const store = new DataStore(() =>
    options.failStorage ? Promise.reject(new DOMException('blocked', 'SecurityError')) : Promise.resolve(repo),
  );
  stores.push(store);
  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders store={store}>
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
  return { ...utils, user, store, repo };
}
