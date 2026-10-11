import { lazy } from 'react';

/**
 * Charts load on demand so Recharts is not part of the initial bundle. The
 * chunks are precached by the service worker, so this also works offline.
 * ChartFrame provides the Suspense boundary and the text/table equivalents.
 */
export const CalorieBarChart = lazy(() => import('./CalorieBarChart').then((m) => ({ default: m.CalorieBarChart })));
export const MacroStackChart = lazy(() => import('./MacroStackChart').then((m) => ({ default: m.MacroStackChart })));
export const LineSeriesChart = lazy(() => import('./LineSeriesChart').then((m) => ({ default: m.LineSeriesChart })));
