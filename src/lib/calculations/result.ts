/** Result of a calculation that can fail for a user-correctable reason. */
export type CalcResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; field?: string };

export const ok = <T>(value: T): CalcResult<T> => ({ ok: true, value });
export const fail = <T = never>(reason: string, field?: string): CalcResult<T> =>
  field === undefined ? { ok: false, reason } : { ok: false, reason, field };

export const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);
