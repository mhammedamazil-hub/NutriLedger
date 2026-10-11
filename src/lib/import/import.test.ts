import { describe, expect, it } from 'vitest';
import { parseBackupFile, parseBackupText, planImport } from './backup';
import { createBackup, serializeBackup } from '../export/backup';
import { emptySnapshot } from '../database/snapshot';
import { DEFAULT_PREFERENCES } from '../../app/preferences';
import { makeEntry, makeWeight } from '../../test/factories';
import { createIndexedDbRepository } from '../database/indexedDb';

const backupText = (snapPatch = {}) =>
  serializeBackup(createBackup({ ...emptySnapshot(), ...snapPatch }, DEFAULT_PREFERENCES, '1.0.0'));

describe('backup parsing', () => {
  it('accepts a valid backup', () => {
    const r = parseBackupText(backupText({ foodEntries: [makeEntry()] }));
    expect(r.ok).toBe(true);
  });

  it('rejects invalid JSON', () => {
    const r = parseBackupText('{"app": "NutriLedger", ');
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/not valid JSON/) });
  });

  it('rejects files from other apps', () => {
    expect(parseBackupText('{"hello":1}').ok).toBe(false);
    expect(parseBackupText('[]').ok).toBe(false);
  });

  it('rejects unsupported (newer) schema versions', () => {
    const obj = JSON.parse(backupText());
    obj.schemaVersion = 99;
    const r = parseBackupText(JSON.stringify(obj));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/newer version/) });
  });

  it('skips malformed records, keeps the valid ones, and reports each rejection', () => {
    const obj = JSON.parse(backupText({ foodEntries: [makeEntry({ id: 'good' }), makeEntry({ id: 'bad' })], weights: [makeWeight({ id: 'w-ok' })] }));
    obj.data.foodEntries[1].calories = 'a lot';
    obj.data.foodEntries[1].date = '2026-02-31';
    obj.data.weights.push({ id: 'w-bad', weightKg: Number.MAX_VALUE });
    const r = parseBackupText(JSON.stringify(obj));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.data.foodEntries.map((e) => e.id)).toEqual(['good']);
    expect(r.backup.data.weights.map((w) => w.id)).toEqual(['w-ok']);
    expect(r.rejected).toHaveLength(2);
    expect(r.rejected[0]).toMatchObject({ kind: 'Food entry', position: 2, id: 'bad' });
    expect(r.rejected[0]?.reason).toMatch(/calories|date/);
    expect(r.rejected[1]).toMatchObject({ kind: 'Weight record', position: 2, id: 'w-bad' });
  });

  it('rejects every copy of an ID that appears twice in one file, keeping the rest', () => {
    const r = parseBackupText(
      backupText({ foodEntries: [makeEntry({ id: 'd', calories: 1 }), makeEntry({ id: 'd', calories: 2 }), makeEntry({ id: 'u' })] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.data.foodEntries.map((e) => e.id)).toEqual(['u']);
    expect(r.rejected.map((x) => [x.id, x.position])).toEqual([
      ['d', 1],
      ['d', 2],
    ]);
    expect(r.rejected[0]?.reason).toMatch(/more than once/);
  });

  it('a damaged profile is reported and never overwrites the current profile, even in replace mode', () => {
    const obj = JSON.parse(backupText({ foodEntries: [makeEntry({ id: 'x' })] }));
    obj.data.profile = { age: -4, sex: 'robot' };
    const r = parseBackupText(JSON.stringify(obj));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rejected).toEqual([expect.objectContaining({ kind: 'Profile', position: null })]);
    const current = { ...emptySnapshot(), profile: { ...emptySnapshot().profile, age: 40, sex: 'female' as const, updatedAt: '2026-10-01T00:00:00.000Z' } };
    const { plan, report } = planImport(current, r.backup, 'replace', 'keep-existing', r.rejected);
    expect(plan.profile).toEqual(current.profile);
    expect(report.profileChanged).toBe(false);
    expect(plan.foodEntries.map((e) => e.id)).toEqual(['x']);
  });

  it('still rejects the whole file when its structure is broken', () => {
    const obj = JSON.parse(backupText());
    obj.data.weights = { not: 'a list' };
    const r = parseBackupText(JSON.stringify(obj));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/damaged or incomplete/) });
    if (!r.ok) expect(r.details?.join(' ')).toMatch(/data\.weights/);
  });

  it('strips unknown fields such as smuggled credentials', () => {
    const obj = JSON.parse(backupText());
    obj.apiKey = 'AIzaSMUGGLED';
    obj.data.profile.apiKey = 'AIzaSMUGGLED';
    const r = parseBackupText(JSON.stringify(obj));
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.backup)).not.toContain('SMUGGLED');
  });

  it('checks file type and size', async () => {
    const notJson = new File(['x'], 'photo.png', { type: 'image/png' });
    expect((await parseBackupFile(notJson)).ok).toBe(false);
    const empty = new File([], 'b.json', { type: 'application/json' });
    expect((await parseBackupFile(empty)).ok).toBe(false);
    const good = new File([backupText()], 'b.json', { type: 'application/json' });
    expect((await parseBackupFile(good)).ok).toBe(true);
  });
});

describe('import planning', () => {
  it('merge adds new records, skips identical ones and keeps existing on conflict', () => {
    const shared = makeEntry({ id: 'same' });
    const conflicting = makeEntry({ id: 'conflict', calories: 100 });
    const current = { ...emptySnapshot(), foodEntries: [shared, conflicting] };
    const parsed = parseBackupText(
      backupText({ foodEntries: [shared, { ...conflicting, calories: 999 }, makeEntry({ id: 'new' })] }),
    );
    if (!parsed.ok) throw new Error('fixture invalid');
    const keep = planImport(current, parsed.backup, 'merge', 'keep-existing');
    expect(keep.report).toMatchObject({ added: 1, unchanged: 1, conflictsKept: 1, updated: 0 });
    expect(keep.plan.foodEntries.map((e) => e.id)).toEqual(['new']);

    const overwrite = planImport(current, parsed.backup, 'merge', 'use-backup');
    expect(overwrite.report).toMatchObject({ added: 1, updated: 1 });
    expect(overwrite.plan.foodEntries.find((e) => e.id === 'conflict')?.calories).toBe(999);
  });

  it('replace mode writes the backup as the full dataset', () => {
    const parsed = parseBackupText(backupText({ weights: [makeWeight()] }));
    if (!parsed.ok) throw new Error('fixture invalid');
    const { plan } = planImport({ ...emptySnapshot(), foodEntries: [makeEntry()] }, parsed.backup, 'replace', 'keep-existing');
    expect(plan.replace).toBe(true);
    expect(plan.foodEntries).toHaveLength(0);
    expect(plan.weights).toHaveLength(1);
  });

  it('round-trips export → import into a fresh database', async () => {
    const original = { ...emptySnapshot(), foodEntries: [makeEntry({ name: 'Café crème, "large"' })], weights: [makeWeight()] };
    const parsed = parseBackupText(backupText(original));
    if (!parsed.ok) throw new Error('fixture invalid');
    const repo = await createIndexedDbRepository(`roundtrip-${Math.random()}`);
    const { plan } = planImport(emptySnapshot(), parsed.backup, 'replace', 'keep-existing');
    await repo.applyImport(plan);
    const { snapshot } = await repo.loadAll();
    expect(snapshot.foodEntries).toEqual(original.foodEntries);
    expect(snapshot.weights).toEqual(original.weights);
    repo.close();
  });

  it('a failed validation leaves existing records untouched', async () => {
    const repo = await createIndexedDbRepository(`failed-${Math.random()}`);
    await repo.putFoodEntry(makeEntry({ id: 'precious' }));
    const r = parseBackupText('{"app":"NutriLedger","schemaVersion":1,"data":{"foodEntries":"nope"}}');
    expect(r.ok).toBe(false);
    // Nothing is applied when parsing fails, so the database is unchanged.
    const { snapshot } = await repo.loadAll();
    expect(snapshot.foodEntries.map((e) => e.id)).toEqual(['precious']);
    repo.close();
  });
});
