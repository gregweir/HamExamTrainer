import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressStore } from './progress.js';
import { contentIdentity } from './ident.js';

const key = (b: string, s: string, t: string) => contentIdentity(b, s, t);

describe('ProgressStore', () => {
  let store: ProgressStore;

  beforeEach(async () => {
    store = new ProgressStore('test-db');
    await store.reset();
  });

  it('records an answer and reads it back by content identity', async () => {
    const k = key('us-tech', 'T1A', 'What is safety?');
    await store.recordAnswer(k, true, 1000);
    const rec = await store.getRecord(k);
    expect(rec).not.toBeNull();
    expect(rec!.correctCount).toBe(1);
    expect(rec!.wrongCount).toBe(0);
    expect(rec!.ease).toBe(2.5);
  });

  it('accumulates mixed answers and exposes the last quality data', async () => {
    const k = key('us-tech', 'T1A', 'What is a dipole?');
    await store.recordAnswer(k, false, 1000);
    await store.recordAnswer(k, true, 2000);
    const rec = await store.getRecord(k);
    expect(rec!.correctCount).toBe(1);
    expect(rec!.wrongCount).toBe(1);
    expect(rec!.attempts).toBe(2);
    expect(rec!.lastStudiedAt).toBe(2000);
  });

  it('returns the due queue sorted by dueAt', async () => {
    const a = key('ca-basic', 'B-001-001', 'q-a');
    const b = key('ca-basic', 'B-001-001', 'q-b');
    const c = key('ca-basic', 'B-001-002', 'q-c');
    // simulate: c due earliest, then a, then b
    await store.recordAnswer(a, true, 1000, { intervalDays: 10, dueAt: 3000 });
    await store.recordAnswer(b, false, 1000, { intervalDays: 0, dueAt: 2000 });
    await store.recordAnswer(c, true, 1000, { intervalDays: 5, dueAt: 1000 });
    const due = await store.dueQueue('ca-basic', 10, 5000);
    expect(due.map(r => r.identity)).toEqual([c, b, a]);
  });

  it('saves, lists and loads resumable exam sessions', async () => {
    await store.saveExamSession({
      bank: 'ca-basic', startedAt: 100, savedAt: 200, position: 12,
      questionIdentities: ['x', 'y', 'z'], answers: [1, 2, 3],
    });
    const s = await store.loadExamSession('ca-basic');
    expect(s?.position).toBe(12);
    expect(s?.answers).toEqual([1, 2, 3]);
    await store.clearExamSession('ca-basic');
    expect(await store.loadExamSession('ca-basic')).toBeNull();
  });

  it('exports and imports everything as portable JSON', async () => {
    const k = key('us-tech', 'T1A', 'What is a dipole?');
    await store.recordAnswer(k, true, 1000, { intervalDays: 4, dueAt: 5000 });
    const dump = await store.exportAll();
    expect(dump.records[k]).not.toBeNull();
    // a fresh store importing the dump must see the same record
    const fresh = new ProgressStore('test-db-2');
    await fresh.reset();
    await fresh.importAll(JSON.parse(JSON.stringify(dump)));
    expect((await fresh.getRecord(k))?.intervalDays).toBe(4);
  });
});
