import { useMemo } from 'react';
import { useData } from '../app/dataContext';
import { computeEstimate, profileToInputs, type FullEstimate } from '../lib/calculations/profileEstimate';
import { daysBetween, todayKey } from '../lib/formatting/dates';
import type { AssessmentInputs, FoodEntry } from '../types/models';

export type ProfileEstimateState =
  | { status: 'incomplete'; reason: string }
  | { status: 'unavailable'; reason: string; inputs: AssessmentInputs }
  | { status: 'ok'; inputs: AssessmentInputs; estimate: FullEstimate; profileAgeDays: number | null };

/** Profile updates older than this trigger a "may be out of date" note on energy figures. */
export const PROFILE_STALE_DAYS = 90;

/** BMR/TDEE derived from the saved profile; recomputed only when the profile changes. */
export function useProfileEstimate(): ProfileEstimateState {
  const profile = useData((s) => s.profile);
  return useMemo(() => {
    const inputs = profileToInputs(profile);
    if (!inputs.ok) return { status: 'incomplete', reason: inputs.reason };
    const est = computeEstimate(inputs.value);
    if (!est.ok) return { status: 'unavailable', reason: est.reason, inputs: inputs.value };
    const updated = profile.updatedAt ? new Date(profile.updatedAt) : null;
    const profileAgeDays =
      updated && !Number.isNaN(updated.getTime())
        ? daysBetween(todayKey(updated), todayKey())
        : null;
    return { status: 'ok', inputs: inputs.value, estimate: est.value, profileAgeDays };
  }, [profile]);
}

/** Entries for one day, in the order they were added. */
export function useDayEntries(date: string): FoodEntry[] {
  const all = useData((s) => s.foodEntries);
  return useMemo(
    () => all.filter((e) => e.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [all, date],
  );
}
