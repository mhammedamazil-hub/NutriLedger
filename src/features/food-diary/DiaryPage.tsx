import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Panel } from '../../components/common/Panel';
import { EmptyState } from '../../components/feedback/EmptyState';
import { SelectField, TextField } from '../../components/forms/Field';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { useTodayKey } from '../../hooks/useTodayKey';
import { useDayEntries } from '../../hooks/useDerived';
import { groupByMeal, sumCalories, totalsFor } from '../../lib/calculations/nutrition';
import { formatDayMedium, isValidDayKey } from '../../lib/formatting/dates';
import { formatInt, pluralize } from '../../lib/formatting/numbers';
import { mealLabel, orderedMeals } from '../../lib/meals';
import type { FoodEntry } from '../../types/models';
import { DateNavigator } from './DateNavigator';
import { DayTotals } from './DayTotals';
import { EntryRow } from './EntryRow';
import { FoodEntryDialog } from './FoodEntryDialog';
import styles from './Diary.module.css';

const SEARCH_LIMIT = 100;

type DialogState = { open: false } | { open: true; entry: FoodEntry | null; meal?: string };

export default function DiaryPage() {
  const today = useTodayKey();
  const [params, setParams] = useSearchParams();
  const rawDate = params.get('date');
  const date = rawDate && isValidDayKey(rawDate) ? rawDate : today;
  const store = useDataStore();
  const toast = useToast();
  const entries = useDayEntries(date);
  const allEntries = useData((s) => s.foodEntries);
  const customMeals = useData((s) => s.customMeals);
  const targets = useData((s) => s.targets);
  const totals = useMemo(() => totalsFor(entries), [entries]);

  const [mealFilter, setMealFilter] = useState('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [confirmDay, setConfirmDay] = useState(false);
  const [localDialog, setLocalDialog] = useState<DialogState>({ open: false });

  // `?add=1` (from dashboard CTA) opens the add dialog; closing removes it from the URL.
  const addFromUrl = params.get('add') === '1';
  const dialog: DialogState = addFromUrl ? { open: true, entry: null } : localDialog;

  const setDate = useCallback(
    (d: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('date', d);
          next.delete('add');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const closeDialog = () => {
    setLocalDialog({ open: false });
    if (addFromUrl) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('add');
          return next;
        },
        { replace: true },
      );
    }
  };

  const byMeal = useMemo(() => groupByMeal(entries), [entries]);
  const meals = orderedMeals(customMeals, byMeal.keys());
  const visibleMeals = mealFilter === 'all' ? meals : meals.filter((m) => m === mealFilter);

  const searchResults = useMemo(() => {
    if (!deferredQuery) return null;
    const matches = allEntries
      .filter((e) => e.name.toLowerCase().includes(deferredQuery) || e.notes.toLowerCase().includes(deferredQuery))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    return { total: matches.length, items: matches.slice(0, SEARCH_LIMIT) };
  }, [allEntries, deferredQuery]);

  const deleteEntry = async (entry: FoodEntry) => {
    try {
      const removed = await store.deleteFoodEntry(entry.id);
      toast.show(`Deleted “${entry.name}”.`, {
        durationMs: 8000,
        action: removed
          ? {
              label: 'Undo',
              onClick: () => {
                store.restoreFoodEntry(removed).then(
                  () => toast.show(`Restored “${removed.name}”.`),
                  () => toast.show('Could not restore the entry.', { tone: 'error' }),
                );
              },
            }
          : undefined,
      });
    } catch {
      toast.show('Could not delete the entry. Nothing was changed.', { tone: 'error' });
    }
  };

  const deleteDay = async () => {
    const ids = entries.map((e) => e.id);
    const n = await store.deleteFoodEntries(ids);
    setConfirmDay(false);
    toast.show(`Deleted ${pluralize(n, 'entry', 'entries')} from ${formatDayMedium(date)}.`);
  };

  const openAdd = (meal?: string) => setLocalDialog(meal ? { open: true, entry: null, meal } : { open: true, entry: null });
  const openEdit = (entry: FoodEntry) => setLocalDialog({ open: true, entry });
  const filterMealOptions = orderedMeals(customMeals, byMeal.keys());

  return (
    <>
      <PageHeader
        title="Food diary"
        description="Record what you eat. Values are the ones you enter — nothing is looked up or guessed."
        actions={
          <Button variant="primary" onClick={() => openAdd(mealFilter !== 'all' ? mealFilter : undefined)} icon={<Plus aria-hidden="true" />}>
            Add food
          </Button>
        }
      />

      <div className="stack">
        <div className={styles.toolbar}>
          <DateNavigator date={date} today={today} onChange={setDate} />
          {entries.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDay(true)}>
              Delete all for this day
            </Button>
          )}
        </div>

        <DayTotals totals={totals} targets={targets} />

        <div className={styles.filters}>
          <TextField
            label="Search all entries"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Food name or note"
            autoComplete="off"
          />
          <SelectField label="Show meal" value={mealFilter} onChange={(e) => setMealFilter(e.target.value)}>
            <option value="all">All meals</option>
            {filterMealOptions.map((m) => (
              <option key={m} value={m}>
                {mealLabel(m)}
              </option>
            ))}
          </SelectField>
        </div>

        {searchResults ? (
          <Panel
            title={`Search results`}
            titleId="search-title"
            description={
              searchResults.total === 0
                ? undefined
                : searchResults.total > SEARCH_LIMIT
                  ? `Showing the ${SEARCH_LIMIT} most recent of ${searchResults.total} matches.`
                  : `${pluralize(searchResults.total, 'match', 'matches')} across all dates.`
            }
            actions={
              <Button size="sm" variant="ghost" onClick={() => setQuery('')}>
                Clear search
              </Button>
            }
          >
            <div aria-live="polite">
              {searchResults.total === 0 ? (
                <EmptyState compact icon={<Search aria-hidden="true" />} title={`No entries match “${query.trim()}”`}>
                  Search looks at food names and notes on every date stored on this device.
                </EmptyState>
              ) : (
                <ul className={styles.entries}>
                  {searchResults.items.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      showDate={`${formatDayMedium(e.date)} · ${mealLabel(e.meal)}`}
                      onEdit={openEdit}
                      onDelete={(x) => void deleteEntry(x)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        ) : entries.length === 0 ? (
          <Panel>
            <EmptyState
              title="Nothing logged for this day"
              headingLevel="h2"
              action={
                <Button variant="primary" onClick={() => openAdd()} icon={<Plus aria-hidden="true" />}>
                  Add food
                </Button>
              }
            >
              Add foods with calories and, if you know them, protein, carbohydrate and fat.
            </EmptyState>
          </Panel>
        ) : (
          <div className={styles.meals}>
            {visibleMeals.map((meal) => {
              const list = byMeal.get(meal) ?? [];
              const headingId = `meal-${meal.replace(/\W+/g, '-')}`;
              return (
                <section key={meal} className={styles.meal} aria-labelledby={headingId}>
                  <div className={styles.mealHeader}>
                    <h2 id={headingId}>
                      {mealLabel(meal)}
                      {list.length > 0 && (
                        <span className={styles.mealMeta}>
                          {formatInt(sumCalories(list))} kcal · {pluralize(list.length, 'item')}
                        </span>
                      )}
                    </h2>
                    <Button size="sm" variant="ghost" onClick={() => openAdd(meal)} icon={<Plus aria-hidden="true" />}>
                      Add<span className="visually-hidden"> to {mealLabel(meal)}</span>
                    </Button>
                  </div>
                  {list.length === 0 ? (
                    <p className={styles.emptyMeal}>No entries.</p>
                  ) : (
                    <ul className={styles.entries}>
                      {list.map((e) => (
                        <EntryRow key={e.id} entry={e} onEdit={openEdit} onDelete={(x) => void deleteEntry(x)} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <FoodEntryDialog
        open={dialog.open}
        onClose={closeDialog}
        entry={dialog.open ? dialog.entry : null}
        defaultDate={date}
        defaultMeal={dialog.open ? dialog.meal : undefined}
      />

      <ConfirmDialog
        open={confirmDay}
        title="Delete all entries for this day?"
        confirmLabel={`Delete ${pluralize(entries.length, 'entry', 'entries')}`}
        destructive
        onConfirm={deleteDay}
        onCancel={() => setConfirmDay(false)}
      >
        <p>
          This permanently removes {pluralize(entries.length, 'entry', 'entries')} ({formatInt(totals.calories)} kcal) from{' '}
          {formatDayMedium(date)}. This cannot be undone.
        </p>
      </ConfirmDialog>
    </>
  );
}
