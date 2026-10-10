import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/public-sans';
import '@fontsource-variable/newsreader';
import './styles/tokens.css';
import './styles/themes.css';
import './styles/global.css';
import { App } from './app/App';
import { AppProviders } from './app/providers';
import { DataStore } from './app/dataStore';
import { createIndexedDbRepository } from './lib/database/indexedDb';
import { PwaProvider } from './app/pwa';

const store = new DataStore(() => createIndexedDbRepository());

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders store={store}>
        <PwaProvider>
          <App />
        </PwaProvider>
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
