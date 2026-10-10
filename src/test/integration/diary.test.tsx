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

const dialog = () => screen.getByRole('dialog');

describe('food diary', () => {
  it('adds, edits and deletes an entry with undo, keeping totals in sync', async () => {
    const today = todayKey();
    const { user, repo } = renderApp(`/diary?date=${today}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Food diary' })).toBeInTheDocument();
    expect(screen.getByText('Nothing logged for this day')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Add food' })[0]!);
    const d = dialog();
    await user.type(within(d).getByRole('textbox', { name: 'Food name' }), 'Greek yogurt');
    await user.type(within(d).getByRole('textbox', { name: 'Calories' }), '146');
    await user.type(within(d).getByRole('textbox', { name: /^Protein \(optional\)/ }), '15');
    await user.selectOptions(within(d).getByRole('combobox', { name: 'Meal' }), 'lunch');
    await user.click(within(d).getByRole('button', { name: 'Save entry' }));

    const lunch = await screen.findByRole('region', { name: /Lunch/ });
    expect(within(lunch).getByText('Greek yogurt')).toBeInTheDocument();
    const totals = screen.getByRole('region', { name: 'Day totals' });
    expect(within(totals).getByText('146')).toBeInTheDocument();
    expect(within(totals).getByText('15 g')).toBeInTheDocument();
    // Carbs and fat were not entered: shown as not recorded, never as 0 g.
    expect(within(totals).getAllByText('Not recorded')).toHaveLength(2);
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(1);

    // Edit
    await user.click(within(lunch).getByRole('button', { name: 'Edit Greek yogurt' }));
    const cal = within(dialog()).getByRole('textbox', { name: 'Calories' });
    await user.clear(cal);
    await user.type(cal, '200');
    await user.click(within(dialog()).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Day totals' })).getByText('200')).toBeInTheDocument());

    // Delete + undo
    await user.click(within(screen.getByRole('region', { name: /Lunch/ })).getByRole('button', { name: 'Delete Greek yogurt' }));
    expect(await screen.findByText('Nothing logged for this day')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Undo: Deleted “Greek yogurt”.' }));
    expect(await screen.findByText('Greek yogurt')).toBeInTheDocument();
    const stored = (await repo.loadAll()).snapshot.foodEntries;
    expect(stored).toHaveLength(1);
    expect(stored[0]?.calories).toBe(200);
  });

  it('validates input inline and does not save invalid entries', async () => {
    const { user, repo } = renderApp('/diary');
    await screen.findByRole('heading', { level: 1, name: 'Food diary' });
    await user.click(screen.getAllByRole('button', { name: 'Add food' })[0]!);
    await user.type(within(dialog()).getByRole('textbox', { name: 'Calories' }), 'abc');
    await user.click(within(dialog()).getByRole('button', { name: 'Save entry' }));
    expect(within(dialog()).getByRole('textbox', { name: 'Food name' })).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog()).getByText(/Enter a number/)).toBeInTheDocument();
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(0);
  });

  it('save and add another keeps the dialog open with date and meal', async () => {
    const { user, repo } = renderApp('/diary');
    await screen.findByRole('heading', { level: 1, name: 'Food diary' });
    await user.click(screen.getAllByRole('button', { name: 'Add food' })[0]!);
    await user.type(within(dialog()).getByRole('textbox', { name: 'Food name' }), 'Apple');
    await user.type(within(dialog()).getByRole('textbox', { name: 'Calories' }), '95');
    await user.click(within(dialog()).getByRole('button', { name: 'Save and add another' }));
    await waitFor(() => expect(within(dialog()).getByRole('textbox', { name: 'Food name' })).toHaveValue(''));
    expect(within(dialog()).getByText(/1 entry saved/)).toBeInTheDocument();
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(1);
  });

  it('scales label values to the portion eaten', async () => {
    const { user } = renderApp('/diary');
    await screen.findByRole('heading', { level: 1, name: 'Food diary' });
    await user.click(screen.getAllByRole('button', { name: 'Add food' })[0]!);
    const d = dialog();
    await user.type(within(d).getByRole('textbox', { name: /^Quantity/ }), '150');
    await user.type(within(d).getByRole('combobox', { name: /^Unit/ }), 'g');
    await user.click(within(d).getByText('Calculate from a nutrition label'));
    await user.type(within(d).getByRole('textbox', { name: 'Calories (kcal)' }), '120');
    await user.type(within(d).getByRole('textbox', { name: /^Protein \(g\)/ }), '10');
    await user.click(within(d).getByRole('button', { name: 'Apply to this portion' }));
    expect(within(d).getByRole('textbox', { name: 'Calories' })).toHaveValue('180');
    expect(within(d).getByRole('textbox', { name: /^Protein \(optional\)/ })).toHaveValue('15');
    expect(within(d).getByRole('textbox', { name: /^Fat \(optional\)/ })).toHaveValue('');
  });

  it('navigates dates, returns to today, and searches across dates', async () => {
    const today = todayKey();
    const yesterday = addDays(today, -1);
    const { user } = renderApp(`/diary?date=${today}`, {
      seed: { foodEntries: [makeEntry({ date: yesterday, name: 'Lentil soup', calories: 320 }), makeEntry({ date: today, name: 'Oats', calories: 150 })] },
    });
    await screen.findByText('Oats');
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(await screen.findByText('Lentil soup')).toBeInTheDocument();
    expect(screen.queryByText('Oats')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(await screen.findByText('Oats')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search all entries' }), 'lentil');
    expect(await screen.findByRole('heading', { name: 'Search results' })).toBeInTheDocument();
    expect(screen.getByText('Lentil soup')).toBeInTheDocument();
  });

  it('requires confirmation before deleting all entries for a day', async () => {
    const today = todayKey();
    const { user, repo } = renderApp(`/diary?date=${today}`, {
      seed: { foodEntries: [makeEntry({ date: today, name: 'A' }), makeEntry({ date: today, name: 'B' })] },
    });
    await screen.findByText('A');
    await user.click(screen.getByRole('button', { name: 'Delete all for this day' }));
    const confirm = screen.getByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('A')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete all for this day' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete 2 entries' }));
    expect(await screen.findByText('Nothing logged for this day')).toBeInTheDocument();
    expect((await repo.loadAll()).snapshot.foodEntries).toHaveLength(0);
  });

  it('dashboard and diary show the same totals from the same records', async () => {
    const today = todayKey();
    const seed = { foodEntries: [makeEntry({ date: today, calories: 410.4, meal: 'breakfast' }), makeEntry({ date: today, calories: 389.4, meal: 'dinner' })] };
    const { user } = renderApp('/', { seed });
    await screen.findByRole('heading', { level: 1, name: 'Today' });
    const intake = screen.getByRole('region', { name: 'Calories recorded today' });
    expect(within(intake).getByText('800')).toBeInTheDocument();
    const byMeal = screen.getByRole('region', { name: 'By meal' });
    expect(within(byMeal).getByText('Breakfast')).toBeInTheDocument();
    expect(within(byMeal).getByText('Dinner')).toBeInTheDocument();
    await user.click(within(byMeal).getByRole('link', { name: 'Open diary' }));
    const totals = await screen.findByRole('region', { name: 'Day totals' });
    expect(within(totals).getByText('800')).toBeInTheDocument();
  });
});
