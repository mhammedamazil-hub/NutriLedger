import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { disposeStores, renderApp } from '../renderApp';
import { preferencesStore } from '../../app/preferences';
import { keyStore } from '../../lib/ai/keyStore';

beforeEach(() => {
  preferencesStore.reset();
  keyStore.clearKey();
});
afterEach(disposeStores);

async function fillProfile(user: UserEvent, { age = '35', weight = '80', height = '178' } = {}) {
  await user.type(screen.getByRole('textbox', { name: 'Age' }), age);
  await user.type(screen.getByRole('textbox', { name: 'Weight' }), weight);
  await user.click(screen.getByRole('radio', { name: 'Male' }));
  await user.type(screen.getByRole('textbox', { name: 'Height' }), height);
  await user.click(screen.getByRole('radio', { name: /Moderately active/ }));
}

describe('calculator', () => {
  it('calculates BMR/TDEE locally, saves the profile, and feeds the dashboard', async () => {
    const { user, repo } = renderApp('/calculator');
    await screen.findByRole('heading', { level: 1, name: 'Energy calculator' });
    expect(screen.getByText('No estimate yet')).toBeInTheDocument();
    await fillProfile(user);
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    // Mifflin–St Jeor (male): 10×80 + 6.25×178 − 5×35 + 5 = 1742.5 → 1,743 (displayed rounded)
    const results = await screen.findByRole('region', { name: 'Results' });
    expect(within(results).getByText('1,743')).toBeInTheDocument();
    // TDEE = 1742.5 × 1.55 = 2700.875 → 2,701
    expect(within(results).getByText('2,701')).toBeInTheDocument();
    expect((await repo.loadAll()).snapshot.profile).toMatchObject({ age: 35, sex: 'male', heightCm: 178, weightKg: 80, activity: 'moderate' });

    // Use TDEE as target → dashboard shows target labelled as coming from the estimate.
    await user.click(within(results).getByRole('button', { name: 'Use TDEE as daily calorie target' }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.targets).toMatchObject({ calories: 2701, calorieSource: 'tdee-estimate' }));
    await user.click(screen.getAllByRole('link', { name: 'Dashboard' })[0]!);
    expect(await screen.findByText('Target (from TDEE estimate)')).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /2,701 kcal remaining of your target/.test(el.textContent ?? '')),
    ).toBeInTheDocument();
  });

  it('describes every readout visualisation in text (charts are not image-only)', async () => {
    const { user } = renderApp('/calculator');
    await screen.findByRole('heading', { level: 1, name: 'Energy calculator' });
    // Before calculating there is no figure, only the empty-state copy.
    expect(within(screen.getByRole('region', { name: 'Results' })).queryByRole('img')).not.toBeInTheDocument();
    await fillProfile(user);
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    const results = await screen.findByRole('region', { name: 'Results' });
    // ±10% of 2,700.875 → 2,430.8 to 2,971.0
    expect(within(results).getByRole('img', { name: /^Likely range 2,431 to 2,971 kcal per day\.$/ })).toBeInTheDocument();
    // BMR 1,742.5 is 64.5% of TDEE; activity allowance 958.4
    expect(
      within(results).getByRole('img', { name: 'Resting metabolism 1,743 kcal (65%) plus activity 958 kcal.' }),
    ).toBeInTheDocument();
    // Same BMR at every multiplier (1.2, 1.375, 1.55, 1.725, 1.9)
    expect(
      within(results).getByRole('img', {
        name: 'Estimated TDEE at each activity level: Sedentary 2,091, Lightly active 2,396, Moderately active 2,701, Very active 3,006, Extra active 3,311 kcal per day. Yours: Moderately active.',
      }),
    ).toBeInTheDocument();
  });

  it('shows inline validation for missing and implausible values', async () => {
    const { user, repo } = renderApp('/calculator');
    await screen.findByRole('heading', { level: 1, name: 'Energy calculator' });
    await user.type(screen.getByRole('textbox', { name: 'Weight' }), '8000');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(screen.getByText('Enter your age in years.')).toBeInTheDocument();
    expect(screen.getByText(/Weight should be between 20 and 500 kg/)).toBeInTheDocument();
    expect(screen.getByText('Choose an activity level.')).toBeInTheDocument();
    expect((await repo.loadAll()).snapshot.profile.updatedAt).toBeNull();
  });

  it('does not show adult estimates or targets for people under 18', async () => {
    const { user } = renderApp('/calculator');
    await screen.findByRole('heading', { level: 1, name: 'Energy calculator' });
    await fillProfile(user, { age: '15', weight: '55', height: '165' });
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(await screen.findByText('Estimates are not shown for people under 18')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Use TDEE/ })).not.toBeInTheDocument();
  });

  it('accepts imperial input and stores metric', async () => {
    const { user, repo } = renderApp('/calculator');
    await screen.findByRole('heading', { level: 1, name: 'Energy calculator' });
    await user.click(screen.getByRole('radio', { name: /Imperial/ }));
    await user.type(screen.getByRole('textbox', { name: 'Age' }), '40');
    await user.type(screen.getByRole('textbox', { name: 'Weight' }), '150');
    await user.click(screen.getByRole('radio', { name: 'Female' }));
    await user.type(screen.getByRole('textbox', { name: 'Height (feet)' }), '5');
    await user.type(screen.getByRole('textbox', { name: 'Height (inches)' }), '5');
    await user.click(screen.getByRole('radio', { name: /Sedentary/ }));
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    await waitFor(async () => {
      const p = (await repo.loadAll()).snapshot.profile;
      expect(p.weightKg).toBeCloseTo(68.04, 1);
      expect(p.heightCm).toBeCloseTo(165.1, 1);
    });
    expect(preferencesStore.get().units).toBe('imperial');
  });

  it('saves assessments to history without overwriting and deletes with confirmation', async () => {
    const { user, repo } = renderApp('/calculator');
    await screen.findByRole('heading', { level: 1, name: 'Energy calculator' });
    await fillProfile(user);
    await user.click(screen.getByRole('button', { name: 'Calculate' }));
    await screen.findByText('2,701');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));
    await user.click(await screen.findByRole('button', { name: 'Save assessment' }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.assessments).toHaveLength(2));
    const history = screen.getByRole('region', { name: 'Assessment history' });
    const deletes = within(history).getAllByRole('button', { name: /Delete assessment/ });
    expect(deletes).toHaveLength(2);
    await user.click(deletes[0]!);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete assessment' }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.assessments).toHaveLength(1));
  });

  it('switching units back and forth never changes typed measurements', async () => {
    const { user } = renderApp('/calculator');
    await screen.findByRole('heading', { level: 1, name: 'Energy calculator' });
    await user.type(screen.getByRole('textbox', { name: 'Weight' }), '80');
    await user.type(screen.getByRole('textbox', { name: 'Height' }), '178');
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('radio', { name: /Imperial/ }));
      expect(screen.getByRole('textbox', { name: 'Height (feet)' })).toHaveValue('5');
      expect(screen.getByRole('textbox', { name: 'Height (inches)' })).toHaveValue('10.1');
      expect(screen.getByRole('textbox', { name: 'Weight' })).toHaveValue('176.4');
      await user.click(screen.getByRole('radio', { name: /Metric/ }));
    }
    // Without the fix this read 178.1 cm (rounding through 5 ft 10.1 in).
    expect(screen.getByRole('textbox', { name: 'Height' })).toHaveValue('178');
    expect(screen.getByRole('textbox', { name: 'Weight' })).toHaveValue('80');
  });
});
