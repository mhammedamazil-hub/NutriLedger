/**
 * End-to-end acceptance journey through the real app (jsdom, in-memory
 * repository, mocked Gemini client). Each numbered step mirrors the manual
 * acceptance scenario documented in README.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { disposeStores, renderApp } from '../renderApp';
import { preferencesStore } from '../../app/preferences';
import { keyStore, REMEMBERED_KEY_STORAGE_NAME } from '../../lib/ai/keyStore';
import { setClientLoaderForTests, type GenAiClientLike } from '../../lib/ai/client';
import { downloadText } from '../../lib/export/download';
import { createMemoryRepository } from '../../lib/database/memory';
import { todayKey } from '../../lib/formatting/dates';

vi.mock('../../lib/export/download', () => ({ downloadText: vi.fn() }));

const KEY = 'AIzaSyTEST-not-a-real-key-1234567890';

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

beforeEach(() => {
  preferencesStore.reset();
  keyStore.clearKey();
});
afterEach(() => {
  disposeStores();
  setClientLoaderForTests(null);
  vi.restoreAllMocks();
});

describe('acceptance journey', () => {
  it('runs the full scenario', { timeout: 60_000 }, async () => {
    const repo = createMemoryRepository();
    const first = renderApp('/', { repository: repo });
    const { user } = first;
    const nav = () => screen.getAllByRole('navigation', { name: 'Main' })[0]!;
    const go = async (name: string) => user.click(within(nav()).getByRole('link', { name }));

    // 1. First visit: empty dashboard, no fake data, no target.
    expect(await screen.findByRole('heading', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.getByText('No daily target set')).toBeInTheDocument();

    // 2–4. Calculator: enter profile, calculate locally, results shown.
    await go('Calculator');
    await user.type(await screen.findByRole('textbox', { name: 'Age' }), '30');
    await user.type(screen.getByRole('textbox', { name: 'Weight' }), '60');
    await user.click(screen.getByRole('radio', { name: 'Female' }));
    await user.type(screen.getByRole('textbox', { name: 'Height' }), '165');
    await user.click(screen.getByRole('radio', { name: /Lightly active/ }));
    await user.click(screen.getByRole('button', { name: 'Calculate and save profile' }));
    // Mifflin–St Jeor female: 600 + 1031.25 − 150 − 161 = 1320.25; × 1.375 = 1815.3
    const results = await screen.findByRole('region', { name: 'Results' });
    expect(within(results).getByText('1,320')).toBeInTheDocument();
    expect(within(results).getByText('1,815')).toBeInTheDocument();

    // 5. Save assessment to history.
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.assessments).toHaveLength(1));

    // 6. Explicitly accept TDEE as the calorie target.
    await user.click(within(results).getByRole('button', { name: 'Use TDEE as daily calorie target' }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.targets.calories).toBe(1815));

    // 7. Set a protein target in Settings.
    await go('Settings');
    const targets = await screen.findByRole('region', { name: 'Daily targets' });
    await user.type(within(targets).getByRole('textbox', { name: /^Protein/ }), '90');
    await user.click(within(targets).getByRole('button', { name: 'Save targets' }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.targets.protein).toBe(90));

    // 8–9. Diary: add breakfast and lunch.
    await go('Food Diary');
    const addFood = async (name: string, meal: string, calories: string, protein?: string) => {
      await user.click((await screen.findAllByRole('button', { name: 'Add food' }))[0]!);
      const d = screen.getByRole('dialog');
      await user.type(within(d).getByRole('textbox', { name: 'Food name' }), name);
      await user.selectOptions(within(d).getByRole('combobox', { name: 'Meal' }), meal);
      await user.type(within(d).getByRole('textbox', { name: 'Calories' }), calories);
      if (protein) await user.type(within(d).getByRole('textbox', { name: /^Protein \(optional\)/ }), protein);
      await user.click(within(d).getByRole('button', { name: 'Save entry' }));
      await screen.findByText(name);
    };
    await addFood('Porridge', 'breakfast', '300', '10');
    await addFood('Salad', 'lunch', '450', '20');

    // 10. Edit an entry.
    await user.click(screen.getByRole('button', { name: 'Edit Salad' }));
    const cal = within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Calories' });
    await user.clear(cal);
    await user.type(cal, '500');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Day totals' })).getByText('800')).toBeInTheDocument());

    // 11. Delete and undo.
    await user.click(screen.getByRole('button', { name: 'Delete Porridge' }));
    await user.click(await screen.findByRole('button', { name: 'Undo: Deleted “Porridge”.' }));
    expect(await screen.findByText('Porridge')).toBeInTheDocument();

    // 12. Dashboard totals match the diary and remaining is computed from the accepted target.
    await go('Dashboard');
    const intake = await screen.findByRole('region', { name: 'Calories recorded today' });
    expect(within(intake).getByText('800')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /1,015 kcal remaining of your target/.test(el.textContent ?? ''))).toBeInTheDocument();

    // 13. Record a weight in Progress.
    await go('Progress');
    const wf = await screen.findByRole('form', { name: 'Add a weight record' });
    await user.type(within(wf).getByRole('textbox', { name: 'Weight' }), '59.5');
    await user.click(within(wf).getByRole('button', { name: 'Add weight' }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.weights).toHaveLength(1));

    // 14. Add a Gemini key (session only).
    await go('Settings');
    const ai = await screen.findByRole('region', { name: 'AI assistant (optional)' });
    await user.type(within(ai).getByLabelText('Gemini API key'), KEY);
    await user.click(within(ai).getByRole('button', { name: 'Save key' }));
    await within(ai).findByText(/held in memory for this session only/);

    // 15–16. AI estimate → review → save; appears with an AI badge in the diary.
    const client: GenAiClientLike = {
      models: {
        generateContent: vi.fn(async () => ({
          text: JSON.stringify({
            status: 'estimate', food_name: 'Apple', portion_description: 'One medium apple', quantity: 1, unit: 'apple',
            calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, fiber_g: 4.4, confidence: 'high', assumptions: [], clarifying_questions: [],
          }),
        })),
        get: vi.fn(async () => ({})),
      },
    };
    setClientLoaderForTests(async () => client);
    await go('AI Nutrition');
    await user.type(await screen.findByRole('textbox', { name: 'What did you eat?' }), 'an apple');
    await user.click(screen.getByRole('button', { name: 'Estimate nutrition' }));
    const review = await screen.findByRole('form', { name: 'Review the estimate' });
    await user.selectOptions(within(review).getByRole('combobox', { name: 'Meal' }), 'snacks');
    await user.click(within(review).getByRole('button', { name: 'Save to diary' }));
    await screen.findByText('Saved to your diary');
    await go('Food Diary');
    const snacks = await screen.findByRole('region', { name: /Snacks/ });
    expect(within(snacks).getByText('AI estimate')).toBeInTheDocument();

    // 17. Go offline: AI is disabled, local features keep working.
    setOnline(false);
    await go('AI Nutrition');
    expect(await screen.findByText('You’re offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estimate nutrition' })).toBeDisabled();
    await go('Food Diary');
    await addFood('Tea', 'other', '5');
    setOnline(true);

    // 18. Export JSON backup: contains records, never the key.
    await go('Settings');
    await user.click(await screen.findByRole('button', { name: 'Download full backup (JSON)' }));
    const backupJson = vi.mocked(downloadText).mock.calls.at(-1)![1];
    expect(backupJson).toContain('"Porridge"');
    expect(backupJson).not.toContain(KEY);

    // 19. Reload: data persists in the repository.
    first.unmount();
    disposeStores();
    const second = renderApp(`/diary?date=${todayKey()}`, { repository: repo });
    expect(await screen.findByText('Porridge')).toBeInTheDocument();
    expect(screen.getByText('Tea')).toBeInTheDocument();
    // The session-only key is not persisted anywhere.
    expect(localStorage.getItem(REMEMBERED_KEY_STORAGE_NAME)).toBeNull();

    // 20–21. Clear all data (typed confirmation).
    await second.user.click(within(screen.getAllByRole('navigation', { name: 'Main' })[0]!).getByRole('link', { name: 'Settings' }));
    await second.user.click(await screen.findByRole('button', { name: 'Clear all local data' }));
    const confirm = screen.getByRole('alertdialog');
    await second.user.type(within(confirm).getByRole('textbox'), 'DELETE');
    await second.user.click(within(confirm).getByRole('button', { name: 'Delete everything' }));
    await waitFor(async () => expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(0));

    // 22. Import the backup: preview, confirm, restored.
    const file = new File([backupJson], 'nutriledger-backup.json', { type: 'application/json' });
    await second.user.upload(screen.getByLabelText(/Choose a NutriLedger backup/), file);
    const dialog = await screen.findByRole('dialog', { name: 'Import backup' });
    await second.user.click(within(dialog).getByRole('button', { name: 'Import' }));
    await waitFor(async () => {
      const snap = (await repo.loadAll()).snapshot;
      expect(snap.foodEntries).toHaveLength(4);
      expect(snap.weights).toHaveLength(1);
      expect(snap.assessments).toHaveLength(1);
      expect(snap.targets.calories).toBe(1815);
    });

    // 23. Dashboard reflects the restored data.
    await second.user.click(within(screen.getAllByRole('navigation', { name: 'Main' })[0]!).getByRole('link', { name: 'Dashboard' }));
    const restored = await screen.findByRole('region', { name: 'Calories recorded today' });
    expect(within(restored).getByText('900')).toBeInTheDocument();
  });
});
