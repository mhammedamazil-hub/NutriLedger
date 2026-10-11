/**
 * Local calendar-day helpers. Day keys are `YYYY-MM-DD` in the user's local
 * time zone. We never use `toISOString()` for day keys because it converts to
 * UTC and can move an evening entry to the next day.
 */
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const todayKey = (now: Date = new Date()): string => toDayKey(now);

/** True only for real calendar dates between 1900-01-01 and 2200-12-31. */
export function isValidDayKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DAY_KEY.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** Parses a day key as local midnight. Throws for invalid keys (callers validate first). */
export function parseDayKey(key: string): Date {
  if (!isValidDayKey(key)) throw new RangeError(`Invalid day key: ${key}`);
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
  const dt = parseDayKey(key);
  dt.setDate(dt.getDate() + delta);
  return toDayKey(dt);
}

/** Inclusive list of `count` day keys ending at `endKey`, oldest first. */
export function lastNDays(endKey: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) out.push(addDays(endKey, -i));
  return out;
}

/** Whole days from a to b (b − a), DST-safe because both are local midnights rounded. */
export function daysBetween(a: string, b: string): number {
  const ms = parseDayKey(b).getTime() - parseDayKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

const longFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const mediumFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const shortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

export const formatDayLong = (key: string): string => longFmt.format(parseDayKey(key));
export const formatDayMedium = (key: string): string => mediumFmt.format(parseDayKey(key));
export const formatDayShort = (key: string): string => shortFmt.format(parseDayKey(key));
export const formatWeekday = (key: string): string => weekdayFmt.format(parseDayKey(key));

/** "Today", "Yesterday", "Tomorrow" or a long date. */
export function relativeDayLabel(key: string, today: string = todayKey()): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return formatDayLong(key);
}

export const nowIso = (): string => new Date().toISOString();
