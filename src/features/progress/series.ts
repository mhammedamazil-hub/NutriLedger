import type { DailyPoint } from '../../lib/calculations/nutrition';
import { addDays, daysBetween, lastNDays } from '../../lib/formatting/dates';

export const RANGES = ['7d', '30d', '90d', '1y', 'all'] as const;
export type RangeKey = (typeof RANGES)[number];

export const RANGE_LABELS: Record<RangeKey, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '1y': '1 year',
  all: 'All',
};

const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

/** Daily aggregation is used up to this many days; longer ranges are shown as weekly averages. */
export const DAILY_LIMIT = 90;

/** First day of a range (inclusive). `earliest` is the oldest record date for "All". */
export function rangeStart(range: RangeKey, today: string, earliest: string | null): string {
  if (range === 'all') {
    if (!earliest || earliest > today) return today;
    return earliest;
  }
  return addDays(today, -(RANGE_DAYS[range] - 1));
}

export function rangeDays(range: RangeKey, today: string, earliest: string | null): string[] {
  const start = rangeStart(range, today, earliest);
  return lastNDays(today, daysBetween(start, today) + 1);
}

export interface BucketPoint {
  /** First day in the bucket. */
  start: string;
  end: string;
  /** Average over logged days only; null if no day in the bucket was logged. */
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  loggedDays: number;
  totalDays: number;
  entryCount: number;
  macrosIncomplete: boolean;
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/**
 * Groups consecutive days into 7-day buckets (the last bucket may be shorter).
 * Each value is the mean of days that actually have data — unlogged days are
 * excluded rather than counted as zero, and nothing is interpolated.
 */
export function weeklyBuckets(points: readonly DailyPoint[]): BucketPoint[] {
  const out: BucketPoint[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const chunk = points.slice(i, i + 7);
    const first = chunk[0];
    const last = chunk.at(-1);
    if (!first || !last) continue;
    const logged = chunk.filter((p) => p.calories !== null);
    const pick = (k: 'protein' | 'carbs' | 'fat') =>
      avg(logged.map((p) => p[k]).filter((v): v is number => v !== null));
    out.push({
      start: first.date,
      end: last.date,
      calories: avg(logged.map((p) => p.calories ?? 0)),
      protein: pick('protein'),
      carbs: pick('carbs'),
      fat: pick('fat'),
      loggedDays: logged.length,
      totalDays: chunk.length,
      entryCount: chunk.reduce((s, p) => s + p.entryCount, 0),
      macrosIncomplete: logged.some((p) => p.macrosIncomplete),
    });
  }
  return out;
}
