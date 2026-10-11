import { useMemo, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Panel } from '../../components/common/Panel';
import { Button } from '../../components/common/Button';
import { NumberField, TextField } from '../../components/forms/Field';
import { EmptyState } from '../../components/feedback/EmptyState';
import { Dialog } from '../../components/dialogs/Dialog';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { ChartFrame, LegendItem } from '../../components/charts/ChartFrame';
import type { LinePoint } from '../../components/charts/LineSeriesChart';
import { LineSeriesChart } from '../../components/charts/lazy';
import { useToast } from '../../components/feedback/toastContext';
import { useData, useDataStore } from '../../app/dataContext';
import { usePreferences } from '../../app/preferences';
import { formatDayMedium, parseDayKey } from '../../lib/formatting/dates';
import { formatOne, formatWeight, pluralize, weightUnit } from '../../lib/formatting/numbers';
import { kgToLb } from '../../lib/calculations/units';
import type { WeightRecord } from '../../types/models';
import { parseWeightForm, weightToDisplay, type WeightFormValues } from './weightForm';
import styles from './Progress.module.css';
import { saveErrorMessage } from '../../lib/database/errors';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

interface Props {
  start: string;
  today: string;
  rangeLabel: string;
}

function WeightFields({
  values,
  setValues,
  errors,
  unit,
  today,
}: {
  values: WeightFormValues;
  setValues: (fn: (v: WeightFormValues) => WeightFormValues) => void;
  errors: Partial<Record<keyof WeightFormValues, string>>;
  unit: string;
  today: string;
}) {
  return (
    <>
      <TextField label="Date" type="date" max={today} value={values.date} onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))} error={errors.date} />
      <NumberField label="Weight" suffix={unit} value={values.weight} onChange={(e) => setValues((v) => ({ ...v, weight: e.target.value }))} error={errors.weight} />
      <TextField label="Note" optional maxLength={1000} value={values.note} onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))} error={errors.note} />
    </>
  );
}

export function WeightSection({ start, today, rangeLabel }: Props) {
  const store = useDataStore();
  const toast = useToast();
  const weights = useData((s) => s.weights);
  const { units } = usePreferences();
  const unit = weightUnit(units);
  const [values, setValues] = useState<WeightFormValues>({ date: today, weight: '', note: '' });
  useUnsavedChanges(values.weight.trim() !== '' || values.note.trim() !== '');
  const [errors, setErrors] = useState<Partial<Record<keyof WeightFormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [editing, setEditing] = useState<WeightRecord | null>(null);
  const [editValues, setEditValues] = useState<WeightFormValues>({ date: today, weight: '', note: '' });
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof WeightFormValues, string>>>({});
  const [confirmClear, setConfirmClear] = useState(false);

  const sorted = useMemo(
    () => [...weights].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    [weights],
  );
  const inRange = sorted.filter((w) => w.date >= start && w.date <= today);
  const display = (kg: number) => (units === 'imperial' ? kgToLb(kg) : kg);
  const data: LinePoint[] = inRange.map((w) => ({
    key: w.id,
    t: parseDayKey(w.date).getTime(),
    fullLabel: formatDayMedium(w.date),
    weight: Math.round(display(w.weightKg) * 10) / 10,
  }));
  const first = inRange[0];
  const last = inRange.at(-1);
  const change = first && last && inRange.length > 1 ? display(last.weightKg) - display(first.weightKg) : null;

  const add = async () => {
    if (busy.current) return;
    const r = parseWeightForm(values, units, today);
    if (!r.ok) return setErrors(r.errors);
    busy.current = true;
    setSaving(true);
    try {
      await store.addWeight(r.value);
      setValues({ date: today, weight: '', note: '' });
      setErrors({});
      toast.show(`Recorded ${formatWeight(r.value.weightKg, units)} for ${formatDayMedium(r.value.date)}.`);
    } catch (err) {
      toast.show(saveErrorMessage(err, 'The weight could not be saved.'), { tone: 'error', durationMs: 10000 });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const remove = async (w: WeightRecord) => {
    try {
      const removed = await store.deleteWeight(w.id);
      toast.show(`Deleted weight record from ${formatDayMedium(w.date)}.`, {
        durationMs: 8000,
        action: removed
          ? { label: 'Undo', onClick: () => void store.restoreWeight(removed).catch(() => toast.show('Could not restore.', { tone: 'error' })) }
          : undefined,
      });
    } catch {
      toast.show('Could not delete the record.', { tone: 'error' });
    }
  };

  const saveEdit = async () => {
    if (!editing || busy.current) return;
    const r = parseWeightForm(editValues, units, today);
    if (!r.ok) return setEditErrors(r.errors);
    busy.current = true;
    try {
      await store.updateWeight(editing.id, r.value);
      setEditing(null);
      toast.show('Weight record updated.');
    } catch (err) {
      setEditErrors({ weight: saveErrorMessage(err, 'Could not save. Try again.') });
    } finally {
      busy.current = false;
    }
  };

  return (
    <Panel
      title="Weight"
      titleId="weight-section"
      description="Your recorded weights. Points are joined with straight lines; nothing is smoothed or projected."
    >
      <div className="stack">
        <form
          className={styles.weightForm}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
          aria-label="Add a weight record"
        >
          <WeightFields values={values} setValues={setValues} errors={errors} unit={unit} today={today} />
          <Button type="submit" variant="primary" loading={saving}>
            Add weight
          </Button>
        </form>

        {sorted.length === 0 ? (
          <EmptyState compact title="No weight records yet">
            Add a weight above to start a history. Daily fluctuations of 1–2 kg are normal; look at trends over weeks.
          </EmptyState>
        ) : inRange.length === 0 ? (
          <EmptyState compact title={`No weight records in the last ${rangeLabel.toLowerCase()}`}>
            Choose a longer range to see older records.
          </EmptyState>
        ) : (
          <ChartFrame
            label="Weight chart"
            height={240}
            summary={
              <>
                {pluralize(inRange.length, 'record')} in this range
                {last && `, latest ${formatWeight(last.weightKg, units)} on ${formatDayMedium(last.date)}`}
                {change !== null && first && `; ${change >= 0 ? '+' : '−'}${formatOne(Math.abs(change))} ${unit} since ${formatDayMedium(first.date)}`}.
              </>
            }
            legend={<LegendItem color="var(--c-chart-cal)">Recorded weight ({unit})</LegendItem>}
            rows={[...data].reverse()}
            rowKey={(r) => r.key}
            columns={[
              { header: 'Date', cell: (r) => r.fullLabel },
              { header: `Weight (${unit})`, cell: (r) => formatOne(Number(r.weight)) },
            ]}
          >
            <LineSeriesChart
              data={data}
              yFormat={(v) => formatOne(v)}
              series={[{ dataKey: 'weight', name: 'Weight', color: 'var(--c-chart-cal)', format: (v) => `${formatOne(v)} ${unit}` }]}
            />
          </ChartFrame>
        )}

        {inRange.length > 0 && (
          <details>
            <summary className="small" style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--c-primary)', minHeight: 'var(--tap)', display: 'flex', alignItems: 'center' }}>
              Edit or delete records ({inRange.length})
            </summary>
            <ul className={styles.list}>
              {[...inRange].reverse().map((w) => (
                <li key={w.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowValue}>{formatWeight(w.weightKg, units)}</span>
                    <span className={styles.rowMeta}>
                      {formatDayMedium(w.date)}
                      {w.note && ` · ${w.note}`}
                    </span>
                  </span>
                  <span className={styles.rowActions}>
                    <Button
                      iconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit weight from ${formatDayMedium(w.date)}`}
                      icon={<Pencil aria-hidden="true" />}
                      onClick={() => {
                        setEditing(w);
                        setEditErrors({});
                        setEditValues({ date: w.date, weight: weightToDisplay(w.weightKg, units), note: w.note });
                      }}
                    />
                    <Button
                      iconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete weight from ${formatDayMedium(w.date)}`}
                      icon={<Trash2 aria-hidden="true" />}
                      onClick={() => void remove(w)}
                    />
                  </span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
                Delete all weight records
              </Button>
            </div>
          </details>
        )}
      </div>

      <Dialog
        open={editing !== null}
        title="Edit weight record"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void saveEdit()}>
              Save changes
            </Button>
          </>
        }
      >
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void saveEdit();
          }}
        >
          <WeightFields values={editValues} setValues={setEditValues} errors={editErrors} unit={unit} today={today} />
          <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        title="Delete all weight records?"
        confirmLabel={`Delete ${pluralize(weights.length, 'record')}`}
        destructive
        requireText="DELETE"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await store.clearWeights();
          setConfirmClear(false);
          toast.show('All weight records deleted.');
        }}
      >
        <p>
          This permanently removes all {pluralize(weights.length, 'weight record')} from this device, including those outside
          the selected range. Food entries and assessments are not affected. Consider exporting a backup first.
        </p>
      </ConfirmDialog>
    </Panel>
  );
}
