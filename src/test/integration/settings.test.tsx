import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { disposeStores, renderApp } from '../renderApp';
import { preferencesStore } from '../../app/preferences';
import { keyStore, REMEMBERED_KEY_STORAGE_NAME } from '../../lib/ai/keyStore';

const KEY = 'AIzaSyTEST-not-a-real-key-1234567890';

beforeEach(() => {
  preferencesStore.reset();
  keyStore.clearKey();
});
afterEach(disposeStores);

describe('settings', () => {
  it('changes theme and units preferences', async () => {
    const { user } = renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(JSON.parse(localStorage.getItem('nutriledger.preferences.v1') ?? '{}')).toMatchObject({ theme: 'dark' });
    await user.click(screen.getAllByRole('radio', { name: /Imperial/ })[0]!);
    expect(preferencesStore.get().units).toBe('imperial');
  });

  it('saves targets, cautions about low targets, and treats empty as no target', async () => {
    const { user, repo } = renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    const targets = screen.getByRole('region', { name: 'Daily targets' });
    await user.type(within(targets).getByRole('textbox', { name: /^Calories/ }), '1100');
    expect(within(targets).getByText('This is a low calorie target')).toBeInTheDocument();
    await user.clear(within(targets).getByRole('textbox', { name: /^Calories/ }));
    await user.type(within(targets).getByRole('textbox', { name: /^Calories/ }), '2000');
    await user.type(within(targets).getByRole('textbox', { name: /^Protein/ }), '120');
    await user.click(within(targets).getByRole('button', { name: 'Save targets' }));
    await waitFor(async () =>
      expect((await repo.loadAll()).snapshot.targets).toMatchObject({ calories: 2000, protein: 120, carbs: null, fat: null, calorieSource: 'manual' }),
    );
  });

  it('enters a key for the session only by default, shows status, and removes it', async () => {
    const { user } = renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    const ai = screen.getByRole('region', { name: 'AI assistant (optional)' });
    expect(within(ai).getByText(/No API key/)).toBeInTheDocument();
    const input = within(ai).getByLabelText('Gemini API key');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(within(ai).getByRole('button', { name: 'Show key' }));
    expect(input).toHaveAttribute('type', 'text');
    await user.type(input, KEY);
    await user.click(within(ai).getByRole('button', { name: 'Save key' }));
    expect(await within(ai).findByText(/held in memory for this session only/)).toBeInTheDocument();
    // Masked, never shown in full.
    expect(within(ai).getByText('AIza…7890')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(KEY);
    expect(localStorage.getItem(REMEMBERED_KEY_STORAGE_NAME)).toBeNull();

    await user.click(within(ai).getByRole('button', { name: 'Remove key' }));
    expect(await within(ai).findByText(/No API key/)).toBeInTheDocument();
    expect(keyStore.get().apiKey).toBeNull();
  });

  it('remembers the key only after opting in, with a clear warning', async () => {
    const { user } = renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    const ai = screen.getByRole('region', { name: 'AI assistant (optional)' });
    await user.type(within(ai).getByLabelText('Gemini API key'), KEY);
    await user.click(within(ai).getByRole('checkbox', { name: /Remember this key/ }));
    expect(within(ai).getByText('Stored unencrypted in this browser')).toBeInTheDocument();
    await user.click(within(ai).getByRole('button', { name: 'Save key' }));
    expect(await within(ai).findByText(/remembered on this device/)).toBeInTheDocument();
    expect(localStorage.getItem(REMEMBERED_KEY_STORAGE_NAME)).toBe(KEY);
    await user.click(within(ai).getByRole('button', { name: 'Remove key' }));
    expect(localStorage.getItem(REMEMBERED_KEY_STORAGE_NAME)).toBeNull();
  });

  it('rejects obviously malformed keys', async () => {
    const { user } = renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    const ai = screen.getByRole('region', { name: 'AI assistant (optional)' });
    await user.type(within(ai).getByLabelText('Gemini API key'), 'abc def');
    await user.click(within(ai).getByRole('button', { name: 'Save key' }));
    expect(within(ai).getByText(/do not contain spaces/)).toBeInTheDocument();
    expect(keyStore.get().apiKey).toBeNull();
  });

  it('manages custom meals and offers them in the diary', async () => {
    const { user } = renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    const meals = screen.getByRole('region', { name: 'Custom meals' });
    await user.type(within(meals).getByRole('textbox', { name: 'New meal name' }), 'Pre-workout');
    await user.click(within(meals).getByRole('button', { name: 'Add meal' }));
    expect(await within(meals).findByText('Pre-workout')).toBeInTheDocument();
    await user.type(within(meals).getByRole('textbox', { name: 'New meal name' }), 'lunch');
    await user.click(within(meals).getByRole('button', { name: 'Add meal' }));
    expect(within(meals).getByText('That meal already exists.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: 'Food Diary' })[0]!);
    await user.click((await screen.findAllByRole('button', { name: 'Add food' }))[0]!);
    expect(within(screen.getByRole('dialog')).getByRole('option', { name: 'Pre-workout' })).toBeInTheDocument();
  });
});
