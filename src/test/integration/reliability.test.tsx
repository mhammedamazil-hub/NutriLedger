import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { disposeStores, renderApp } from '../renderApp';
import { makeEntry } from '../factories';
import { preferencesStore } from '../../app/preferences';
import { keyStore } from '../../lib/ai/keyStore';
import { addDays, todayKey } from '../../lib/formatting/dates';
import { createMemoryRepository } from '../../lib/database/memory';
import { emptySnapshot } from '../../lib/database/snapshot';
import { createBackup, serializeBackup } from '../../lib/export/backup';
import { QUOTA_MESSAGE } from '../../lib/database/errors';
import { unsavedChanges } from '../../app/unsavedChanges';

beforeEach(() => {
  preferencesStore.reset();
  keyStore.clearKey();
});
afterEach(() => {
  disposeStores();
  unsavedChanges.resetForTests();
});

const quotaError = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError');

describe('food diary reliability', () => {
  it('duplicates an entry as a reviewed new record, optionally on another date', async () => {
    const today = todayKey();
    const yesterday = addDays(today, -1);
    const original = makeEntry({ date: today, meal: 'breakfast', name: 'Oats', calories: 312.5, protein: 10.25, carbs: null, source: 'ai-estimate' });
    const { user, repo } = renderApp(`/diary?date=${today}`, { seed: { foodEntries: [original] } });
    await screen.findByRole('heading', { level: 1, name: 'Food diary' });

    await user.click(screen.getByRole('button', { name: 'Duplicate Oats' }));
    const d = screen.getByRole('dialog', { name: 'Duplicate food entry' });
    // Pre-filled from the original, including decimals and "not recorded" carbs.
    expect(within(d).getByRole('textbox', { name: 'Food name' })).toHaveValue('Oats');
    expect(within(d).getByRole('textbox', { name: 'Calories' })).toHaveValue('312.5');
    expect(within(d).getByRole('textbox', { name: /^Carbohydrate \(optional\)/ })).toHaveValue('');
    // Nothing is written until the user saves.
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(1);

    const date = within(d).getByLabelText('Date');
    fireEvent.change(date, { target: { value: yesterday } });
    await user.click(within(d).getByRole('button', { name: 'Save entry' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const stored = (await repo.loadAll()).snapshot.foodEntries;
    expect(stored).toHaveLength(2);
    const copy = stored.find((e) => e.id !== original.id)!;
    expect(copy).toMatchObject({ date: yesterday, meal: 'breakfast', name: 'Oats', calories: 312.5, protein: 10.25, carbs: null, source: 'ai-estimate' });
    // The original is untouched.
    expect(stored.find((e) => e.id === original.id)).toEqual(original);
  });

  it('a rapid double submit creates exactly one entry', async () => {
    const today = todayKey();
    const { user, repo } = renderApp(`/diary?date=${today}`);
    await screen.findByRole('heading', { level: 1, name: 'Food diary' });
    await user.click(screen.getAllByRole('button', { name: 'Add food' })[0]!);
    const d = screen.getByRole('dialog');
    await user.type(within(d).getByRole('textbox', { name: 'Food name' }), 'Toast');
    await user.type(within(d).getByRole('textbox', { name: 'Calories' }), '90');
    const save = within(d).getByRole('button', { name: 'Save entry' });
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(1);
  });

  it('editing never creates a duplicate and keeps the entry on its date and meal', async () => {
    const today = todayKey();
    const entry = makeEntry({ date: today, meal: 'dinner', name: 'Soup', calories: 200 });
    const { user, repo } = renderApp(`/diary?date=${today}`, { seed: { foodEntries: [entry] } });
    await screen.findByRole('heading', { level: 1, name: 'Food diary' });
    await user.click(screen.getByRole('button', { name: 'Edit Soup' }));
    const d = screen.getByRole('dialog');
    const cal = within(d).getByRole('textbox', { name: 'Calories' });
    await user.clear(cal);
    await user.type(cal, '210.4');
    await user.click(within(d).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const stored = (await repo.loadAll()).snapshot.foodEntries;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: entry.id, date: today, meal: 'dinner', calories: 210.4 });
  });

  it('a full device keeps the form open with a clear message and changes nothing', async () => {
    const today = todayKey();
    const repo = createMemoryRepository(emptySnapshot());
    vi.spyOn(repo, 'putFoodEntry').mockRejectedValueOnce(quotaError());
    const { user } = renderApp(`/diary?date=${today}`, { repository: repo });
    await screen.findByRole('heading', { level: 1, name: 'Food diary' });
    await user.click(screen.getAllByRole('button', { name: 'Add food' })[0]!);
    const d = screen.getByRole('dialog');
    await user.type(within(d).getByRole('textbox', { name: 'Food name' }), 'Apple');
    await user.type(within(d).getByRole('textbox', { name: 'Calories' }), '95');
    await user.click(within(d).getByRole('button', { name: 'Save entry' }));

    expect(await within(d).findByText(QUOTA_MESSAGE)).toBeInTheDocument();
    // Typed values are preserved so the user can retry.
    expect(within(d).getByRole('textbox', { name: 'Food name' })).toHaveValue('Apple');
    expect(screen.getByText('Nothing logged for this day')).toBeInTheDocument();
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(0);

    // Retrying after space is freed succeeds.
    await user.click(within(d).getByRole('button', { name: 'Save entry' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(1);
  });

  it('a failed bulk delete keeps the confirmation open, explains, and deletes nothing', async () => {
    const today = todayKey();
    const repo = createMemoryRepository({ ...emptySnapshot(), foodEntries: [makeEntry({ date: today }), makeEntry({ date: today })] });
    vi.spyOn(repo, 'deleteMany').mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    const { user } = renderApp(`/diary?date=${today}`, { repository: repo });
    await screen.findByRole('heading', { level: 1, name: 'Food diary' });
    await user.click(screen.getByRole('button', { name: 'Delete all for this day' }));
    const d = await screen.findByRole('alertdialog', { name: 'Delete all entries for this day?' });
    await user.click(within(d).getByRole('button', { name: 'Delete 2 entries' }));

    const alert = await within(d).findByRole('alert');
    expect(alert).toHaveTextContent(/Nothing was changed/);
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(2);

    // A successful retry deletes both.
    await user.click(within(d).getByRole('button', { name: 'Delete 2 entries' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(0);
  });
});

describe('partial import', () => {
  it('reports rejected records and imports only the valid ones', async () => {
    const good = makeEntry({ name: 'Valid entry' });
    const backup = createBackup({ ...emptySnapshot(), foodEntries: [good] }, preferencesStore.get(), '1.0.0');
    const raw = JSON.parse(serializeBackup(backup)) as { data: { foodEntries: unknown[] } };
    raw.data.foodEntries.push({ ...makeEntry({ name: 'Broken' }), calories: -50 });
    const file = new File([JSON.stringify(raw)], 'backup.json', { type: 'application/json' });

    const { user, repo } = renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.upload(screen.getByLabelText(/Choose a NutriLedger backup/), file);
    const dialog = await screen.findByRole('dialog', { name: 'Import backup' });
    expect(within(dialog).getByText('1 item in this file can’t be imported')).toBeInTheDocument();
    expect(within(dialog).getByText('Food entry #2')).toBeInTheDocument();
    // Nothing written before confirmation.
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Import valid records' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const stored = (await repo.loadAll()).snapshot.foodEntries;
    expect(stored.map((e) => e.name)).toEqual(['Valid entry']);
    expect(await screen.findByText(/1 invalid item skipped/)).toBeInTheDocument();
  });
});

describe('app update safety', () => {
  const pwa = (update: () => Promise<void>) => ({ needRefresh: true, offlineReady: false, update, dismissOfflineReady: () => undefined });

  it('updates immediately when no form has unsaved changes', async () => {
    const update = vi.fn(async () => undefined);
    const { user } = renderApp('/', { pwa: pwa(update) });
    await user.click(await screen.findByRole('button', { name: 'Reload to update' }));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('asks before an update reload would discard unsaved form input', async () => {
    const update = vi.fn(async () => undefined);
    const today = todayKey();
    const { user } = renderApp(`/diary?date=${today}`, { pwa: pwa(update) });
    await screen.findByRole('heading', { level: 1, name: 'Food diary' });
    await user.click(screen.getAllByRole('button', { name: 'Add food' })[0]!);
    await user.type(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Food name' }), 'Half-typed');
    expect(unsavedChanges.has()).toBe(true);

    // The banner sits behind the modal; activate it the way a keyboard user would after closing nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Reload to update', hidden: true }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText(/You have unsaved changes in a form/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update anyway', hidden: true }));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('stops counting a form as unsaved once it is saved or closed', async () => {
    const today = todayKey();
    const { user } = renderApp(`/diary?date=${today}`);
    await screen.findByRole('heading', { level: 1, name: 'Food diary' });
    await user.click(screen.getAllByRole('button', { name: 'Add food' })[0]!);
    const d = screen.getByRole('dialog');
    await user.type(within(d).getByRole('textbox', { name: 'Food name' }), 'Pear');
    await user.type(within(d).getByRole('textbox', { name: 'Calories' }), '100');
    expect(unsavedChanges.has()).toBe(true);
    await user.click(within(d).getByRole('button', { name: 'Save entry' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(unsavedChanges.has()).toBe(false);
  });
});
