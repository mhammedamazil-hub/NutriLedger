import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { Notice } from '../components/feedback/Notice';
import { Button } from '../components/common/Button';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { NotFoundPage } from './NotFoundPage';

/**
 * Lazy route chunks are precached by the service worker, so they load offline
 * after the first visit. If a chunk is missing (e.g. a stale tab after a
 * deploy) the boundary offers a reload instead of a blank screen.
 */
const DiaryPage = lazy(() => import('../features/food-diary/DiaryPage'));
const CalculatorPage = lazy(() => import('../features/calculator/CalculatorPage'));
const ProgressPage = lazy(() => import('../features/progress/ProgressPage'));
const AiPage = lazy(() => import('../features/ai-nutrition/AiPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));

function PageLoading() {
  return (
    <p className="muted" role="status">
      Loading…
    </p>
  );
}

function RouteBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      label="This section"
      fallback={
        <Notice tone="warning" title="This section could not be loaded." role="alert">
          <div className="stack-sm">
            <span>Your saved records are safe. If NutriLedger was just updated, reloading usually fixes this.</span>
            <div>
              <Button size="sm" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </div>
          </div>
        </Notice>
      }
    >
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<RouteBoundary><DashboardPage /></RouteBoundary>} />
        <Route path="diary" element={<RouteBoundary><DiaryPage /></RouteBoundary>} />
        <Route path="calculator" element={<RouteBoundary><CalculatorPage /></RouteBoundary>} />
        <Route path="progress" element={<RouteBoundary><ProgressPage /></RouteBoundary>} />
        <Route path="ai" element={<RouteBoundary><AiPage /></RouteBoundary>} />
        <Route path="settings" element={<RouteBoundary><SettingsPage /></RouteBoundary>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
