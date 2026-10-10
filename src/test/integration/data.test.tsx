import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { disposeStores, renderApp } from '../renderApp';
import { makeEntry, makeWeight } from '../factories';
import { preferencesStore } from '../../app/preferences';
import { keyStore, REMEMBERED_KEY_STORAGE_NAME } from '../../lib/ai/keyStore';
import { createBackup, serializeBackup } from '../../lib/export/backup';
import { emptySnapshot } from '../../lib/database/snapshot';
import { downloadText } from '../../lib/export/download';

vi.mock('../../lib/export/download', () => ({ downloadText: vi.fn() }));

const KEY = 'AIzaSyTEST-not-a-real-key-1234567890';

beforeEach(() => {
  preferencesStore.reset();
  keyStore.clearKey();
  vi.mocked(downloadText).mockClear();
});
afterEach(disposeStores);

describe('data management', () => {
  it('exports a JSON backup that never contains the API key', async () => {
    keyStore.setKey(KEY, true);
    const { user } = renderApp('/settings', { seed: { foodEntries: [makeEntry({ name: 'Rice' })] } });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.click(screen.getByRole('button', { name: 'Download full backup (JSON)' }));
    expect(downloadText).toHaveBeenCalledTimes(1);
    const [filename, content, mime] = vi.mocked(downloadText).mock.calls[0]!;
    expect(filename).toMatch(/^nutriledger-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(mime).toBe('application/json');
    expect(content).toContain('"Rice"');
    expect(content).toContain('"schemaVersion": 1');
    expect(content).not.toContain(KEY);
    expect(content.toLowerCase()).not.toContain('apikey');
  });

  it('exports CSV with formula-injection protection', async () => {
    const { user } = renderApp('/settings', { seed: { foodEntries: [makeEntry({ name: '=HYPERLINK("x")' })] } });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.click(screen.getByRole('button', { name: 'Food entries CSV' }));
    const [, csv] = vi.mocked(downloadText).mock.calls[0]!;
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    // CSV buttons are disabled when there is nothing to export.
    expect(screen.getByRole('button', { name: 'Weights CSV' })).toBeDisabled();
  });

  it('previews an import, merges it atomically, and reports what changed', async () => {
    const existing = makeEntry({ name: 'Existing' });
    const incoming = makeEntry({ name: 'From backup' });
    const backup = createBackup({ ...emptySnapshot(), foodEntries: [existing, incoming], weights: [makeWeight()] }, preferencesStore.get(), '1.0.0');
    const file = new File([serializeBackup(backup)], 'backup.json', { type: 'application/json' });
    const { user, repo } = renderApp('/settings', { seed: { foodEntries: [existing] } });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.upload(screen.getByLabelText(/Choose a NutriLedger backup/), file);
    const dialog = await screen.findByRole('dialog', { name: 'Import backup' });
    expect(within(dialog).getByText(/2 new records added, 1 identical skipped/)).toBeInTheDocument();
    // Nothing written before confirmation.
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    await waitFor(async () => {
      const snap = (await repo.loadAll()).snapshot;
      expect(snap.foodEntries.map((e) => e.name).sort()).toEqual(['Existing', 'From backup']);
      expect(snap.weights).toHaveLength(1);
    });
    expect(await screen.findByText(/Import complete: 2 added/)).toBeInTheDocument();
  });

  it('rejects invalid files without changing data', async () => {
    const { user, repo } = renderApp('/settings', { seed: { foodEntries: [makeEntry()] } });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.upload(screen.getByLabelText(/Choose a NutriLedger backup/), new File(['{not json'], 'bad.json', { type: 'application/json' }));
    expect(await screen.findByText('This file can’t be imported')).toBeInTheDocument();
    expect(screen.getByText(/not valid JSON/)).toBeInTheDocument();
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(1);
  });

  it('clears all local data only after typing DELETE', async () => {
    keyStore.setKey(KEY, true);
    preferencesStore.update({ theme: 'dark' });
    const { user, repo } = renderApp('/settings', { seed: { foodEntries: [makeEntry()], weights: [makeWeight()] } });
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await user.click(screen.getByRole('button', { name: 'Clear all local data' }));
    const confirm = screen.getByRole('alertdialog');
    const button = within(confirm).getByRole('button', { name: 'Delete everything' });
    expect(button).toBeDisabled();
    await user.type(within(confirm).getByRole('textbox'), 'DELETE');
    expect(button).toBeEnabled();
    await user.click(button);
    await waitFor(async () => {
      const snap = (await repo.loadAll()).snapshot;
      expect(snap.foodEntries).toHaveLength(0);
      expect(snap.weights).toHaveLength(0);
    });
    expect(localStorage.getItem(REMEMBERED_KEY_STORAGE_NAME)).toBeNull();
    expect(keyStore.get().apiKey).toBeNull();
    expect(preferencesStore.get().theme).toBe('system');
  });

  it('warns clearly when durable storage is unavailable but keeps working', async () => {
    const { user } = renderApp('/', { failStorage: true });
    expect(await screen.findByText(/did not allow NutriLedger to open its local database/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('link', { name: 'Food Diary' })[0]!);
    await user.click((await screen.findAllByRole('button', { name: 'Add food' }))[0]!);
    const d = screen.getByRole('dialog');
    await user.type(within(d).getByRole('textbox', { name: 'Food name' }), 'Tea');
    await user.type(within(d).getByRole('textbox', { name: 'Calories' }), '2');
    await user.click(within(d).getByRole('button', { name: 'Save entry' }));
    expect(await screen.findByText('Tea')).toBeInTheDocument();
  });
});
