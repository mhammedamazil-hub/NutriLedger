import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { disposeStores, renderApp } from '../renderApp';
import { makeEntry } from '../factories';
import { preferencesStore } from '../../app/preferences';
import { keyStore } from '../../lib/ai/keyStore';
import { addDays, todayKey } from '../../lib/formatting/dates';

beforeEach(() => {
  preferencesStore.reset();
  keyStore.clearKey();
});
afterEach(disposeStores);

describe('progress', () => {
  it('shows empty states without inventing data', async () => {
    renderApp('/progress');
    expect(await screen.findByRole('heading', { level: 1, name: 'Progress' })).toBeInTheDocument();
    expect(screen.getByText('No food logged in this range')).toBeInTheDocument();
    expect(screen.getByText('No weight records yet')).toBeInTheDocument();
    expect(screen.getByText('No saved assessments')).toBeInTheDocument();
  });

  it('summarises logged days and treats unlogged days as missing', async () => {
    const today = todayKey();
    renderApp('/progress?range=7d', {
      seed: { foodEntries: [makeEntry({ date: today, calories: 2000 }), makeEntry({ date: addDays(today, -2), calories: 1000 })] },
    });
    const calories = await screen.findByRole('region', { name: 'Calories' });
    expect(within(calories).getByText((_, el) => el?.tagName === 'SPAN' && /Logged 2 of 7 days/.test(el.textContent ?? ''))).toBeInTheDocument();
    // Average over logged days only: (2000 + 1000) / 2
    expect(within(calories).getByText('1,500')).toBeInTheDocument();
    expect(within(calories).getAllByText('Not logged').length).toBe(5);
  });

  it('adds, converts and deletes weight records', async () => {
    preferencesStore.update({ units: 'imperial' });
    const { user, repo } = renderApp('/progress');
    await screen.findByRole('heading', { level: 1, name: 'Progress' });
    const form = screen.getByRole('form', { name: 'Add a weight record' });
    await user.type(within(form).getByRole('textbox', { name: 'Weight' }), '165');
    await user.click(within(form).getByRole('button', { name: 'Add weight' }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.weights[0]?.weightKg).toBeCloseTo(74.84, 1));
    expect(await screen.findByText(/latest 165 lb/)).toBeInTheDocument();

    await user.click(screen.getByText(/Edit or delete records/));
    await user.click(screen.getByRole('button', { name: /Delete weight from/ }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.weights).toHaveLength(0));
    await user.click(await screen.findByRole('button', { name: /^Undo: Deleted weight record from / }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.weights).toHaveLength(1));
  });

  it('switches time range via the range control', async () => {
    const { user } = renderApp('/progress');
    await screen.findByRole('heading', { level: 1, name: 'Progress' });
    expect(screen.getByRole('radio', { name: '30 days' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: '90 days' }));
    expect(screen.getByRole('radio', { name: '90 days' })).toBeChecked();
  });
});
