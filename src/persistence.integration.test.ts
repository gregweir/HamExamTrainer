/**
 * Full-bank integration regression checks using actual components and the
 * real ProgressStore with Vitest's fake-indexeddb adapter. These are NOT a
 * substitute for browser restart / offline E2E checks.
 */
import { afterEach, describe, expect, it } from 'vitest';
import './components/exam-shell.js';
import type { ExamShell } from './components/exam-shell.js';
import type { QuestionCard } from './components/question-card.js';
import { ProgressStore } from './lib/progress.js';
import { contentIdentityFromQuestion } from './lib/ident.js';
import {
  BANKS, US_TECH, US_GENERAL, US_EXTRA, CA_BASIC, CA_ADVANCED,
  type ExamQuestion,
} from './data/exam-banks.js';

const pools: Record<string, ExamQuestion[]> = {
  'us-tech': US_TECH, 'us-general': US_GENERAL, 'us-extra': US_EXTRA,
  'ca-basic': CA_BASIC as unknown as ExamQuestion[],
  'ca-advanced': CA_ADVANCED as unknown as ExamQuestion[],
};
const live: { el: ExamShell; store: ProgressStore }[] = [];

async function until(check: () => unknown | Promise<unknown>, detail: string) {
  for (let n = 0; n < 200; n++) {
    if (await check()) return;
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error(`Timed out: ${detail}`);
}
async function mount(dbName: string) {
  const store = new ProgressStore(dbName);
  const el = document.createElement('exam-shell');
  el.progress = store; // bind before connecting, as actual production does
  document.body.append(el);
  live.push({ el, store });
  await el.updateComplete;
  await until(() => el.sectionStats.length > 0, 'initial section stats');
  return { el, store };
}
async function unmount(el: ExamShell, store: ProgressStore) {
  el.remove();
  // Close only this disposable test database connection. The production
  // API has no close method; the replacement must open its own connection.
  (store as any).db?.close();
}
async function select(el: ExamShell, bank: string) {
  const select = el.shadowRoot!.querySelector<HTMLSelectElement>('select.bank-chooser')!;
  select.value = bank;
  select.dispatchEvent(new Event('change'));
  await el.updateComplete;
  await until(async () => await el.progress.getSetting('bank', '') === bank, 'bank save');
  await until(() => el.sectionStats.length === BANKS.find(b => b.id === bank)!.sections.length, 'bank stats');
}
async function tab(el: ExamShell, index: number) {
  (el.shadowRoot!.querySelectorAll('button.tab')[index] as HTMLButtonElement).click();
  await el.updateComplete;
}
async function card(el: ExamShell): Promise<QuestionCard> {
  const exam = el.shadowRoot!.querySelector('exam-session');
  if (exam) await exam.updateComplete;
  const root = exam?.shadowRoot ?? el.shadowRoot!;
  await until(() => !!root.querySelector('question-card'), 'question card');
  const qc = root.querySelector('question-card')!;
  await qc.updateComplete;
  return qc;
}
async function button(el: HTMLElement, label: string) {
  await (el as any).updateComplete;
  const b = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button')]
    .find(b => b.textContent!.trim() === label);
  expect(b, `button ${label}`).toBeDefined();
  b!.click();
  await (el as any).updateComplete;
}
async function startSection(el: ExamShell, id: string) {
  const list = el.shadowRoot!.querySelector('chapter-list')!;
  await list.updateComplete;
  const row = [...list.shadowRoot!.querySelectorAll<HTMLButtonElement>('.section-row')]
    .find(b => b.querySelector('.section-id')!.textContent === id)!;
  expect(row).toBeDefined(); row.click(); await el.updateComplete;
}

afterEach(() => {
  for (const { el, store } of live.splice(0)) {
    el.remove(); (store as any).db?.close();
  }
});

describe('full-level persistence through real components + IndexedDB adapter', () => {
  for (const bank of BANKS) {
    it(`${bank.id}: complete every question, reopen storage, change banks, and continue`, async () => {
      const dbName = `isolated-full-bank-${bank.id}-${crypto.randomUUID()}`;
      let { el, store } = await mount(dbName);
      await select(el, bank.id);
      const questions = pools[bank.id]!;
      let n = 0;
      const identityAttempts = new Map<string, number>();
      for (const [sectionNumber, section] of bank.sections.entries()) {
        await startSection(el, section);
        for (const q of questions.filter(q => q.section === section)) {
          const qc = await card(el);
          expect(qc.question!.id).toBe(q.id);
          const choice = n % 10 === 0 ? (q.correctIndex + 1) % q.choices.length : q.correctIndex;
          (qc.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.choice')[choice]!).click();
          await qc.updateComplete;
          const identity = contentIdentityFromQuestion(q);
          const attempts = (identityAttempts.get(identity) ?? 0) + 1;
          identityAttempts.set(identity, attempts);
          await until(async () => (await store.getRecord(identity))?.attempts === attempts, `save ${q.id}`);
          qc.shadowRoot!.querySelector<HTMLButtonElement>('button.next')!.click();
          await el.updateComplete;
          n++;
        }
        expect(el.shadowRoot!.querySelector('.done-note')!.textContent).toContain(section);
        await tab(el, 0);
        await until(() => el.sectionStats.reduce((s, r) => s + r.studied, 0) === n, 'coverage updates');
        if (sectionNumber === 0 || sectionNumber === Math.floor(bank.sections.length / 2)) {
          const before = await store.exportAll();
          await unmount(el, store);
          ({ el, store } = await mount(dbName));
          await until(() => el.bank.id === bank.id, 'bank restored');
          await until(() => el.sectionStats.reduce((s, r) => s + r.studied, 0) === n, 'reopened coverage');
          expect(await store.exportAll()).toEqual(before);
        }
      }
      expect(n).toBe(questions.length);
      const before = await store.exportAll();
      expect(Object.keys(before.records), 'storage remains keyed by content identity').toHaveLength(identityAttempts.size);
      expect(Object.values(before.records).reduce((sum, record) => sum + record.attempts, 0),
        'every native-question attempt remains stored').toBe(questions.length);
      expect(Object.values(before.records).every(r => r.attempts === identityAttempts.get(r.identity))).toBe(true);
      expect(Object.values(before.records).reduce((n, r) => n + r.wrongCount, 0)).toBe(Math.ceil(questions.length / 10));
      expect(el.shadowRoot!.querySelector('.ready-num')!.textContent).toBe('100%');
      expect.soft(el.sectionStats.filter(s => s.studied !== s.total), 'every completed section should be marked done').toEqual([]);
      const other = bank.id === 'us-tech' ? 'ca-basic' : 'us-tech';
      await select(el, other);
      await until(() => el.sectionStats.every(s => s.studied === 0), 'other bank remains empty');
      await select(el, bank.id);
      await until(() => el.sectionStats.reduce((s, r) => s + r.studied, 0) === questions.length, 'original bank remains complete');
      expect((await store.exportAll()).records).toEqual(before.records);
      await unmount(el, store);
      ({ el, store } = await mount(dbName));
      await until(() => el.bank.id === bank.id, 'final bank restore');
      await until(() => el.sectionStats.reduce((s, r) => s + r.studied, 0) === questions.length, 'final coverage restore');
      expect(await store.exportAll()).toEqual(before);
      // Continue studying after returning; only the answered item changes.
      await startSection(el, bank.sections[0]!);
      const qc = await card(el);
      const identity = contentIdentityFromQuestion(qc.question!);
      qc.shadowRoot!.querySelector<HTMLButtonElement>('button.choice')!.click();
      await until(async () => (await store.getRecord(identity))?.attempts === 2, 'continued answer recorded');
      const after = await store.exportAll();
      for (const [key, old] of Object.entries(before.records)) {
        if (key !== identity) expect(after.records[key]).toEqual(old);
      }
    }, 60_000);

    it(`${bank.id}: interrupt full mock exam, restore exact paper, finish and retain verdict`, async () => {
      const dbName = `isolated-exam-${bank.id}-${crypto.randomUUID()}`;
      let { el, store } = await mount(dbName);
      await select(el, bank.id);
      await tab(el, 2);
      let exam = el.shadowRoot!.querySelector('exam-session')!;
      await button(exam, 'Start the exam');
      await until(async () => !!(await store.loadExamSession(bank.id)), 'start exam saved');
      for (let i = 0; i < bank.examLength; i++) {
        const qc = await card(el);
        const correct = qc.question!.correctIndex;
        const choice = i === 0 ? (correct + 1) % 4 : correct;
        qc.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.choice')[choice]!.click();
        await until(async () => (await store.loadExamSession(bank.id))!.answers.filter(a => a !== null).length === i + 1, 'exam answer saved');
        if (i === Math.floor(bank.examLength / 2)) {
          const before = await store.exportAll();
          await unmount(el, store);
          ({ el, store } = await mount(dbName));
          await until(() => el.bank.id === bank.id, 'exam bank restored');
          await tab(el, 2);
          exam = el.shadowRoot!.querySelector('exam-session')!;
          await card(el);
          expect(await store.exportAll()).toEqual(before);
          expect(exam.shadowRoot!.textContent).toContain(`Question ${i + 2} / ${bank.examLength}`);
        }
      }
      await button(exam, 'Submit exam');
      await until(async () => (await store.bankAttempts(bank.id)).length === 1, 'verdict saved');
      await until(async () => (await store.loadExamSession(bank.id)) === null, 'submitted session cleared');
      const before = await store.exportAll();
      expect(before.attempts[0]!.correct).toBe(bank.examLength - 1);
      expect(before.attempts[0]!.total).toBe(bank.examLength);
      expect(before.attempts[0]!.passed).toBe(true);
      await unmount(el, store);
      ({ el, store } = await mount(dbName));
      await until(() => el.bank.id === bank.id, 'history bank restored');
      await tab(el, 2);
      exam = el.shadowRoot!.querySelector('exam-session')!;
      await until(() => !!exam.shadowRoot?.querySelector('.history'), 'history rendered');
      expect(exam.shadowRoot!.querySelector('.history')!.textContent).toContain(`${Math.floor((bank.examLength - 1) * 100 / bank.examLength)}% PASS`);
      expect(await store.exportAll()).toEqual(before);
    }, 30_000);
  }
});

describe('interruption regression probes', () => {
  it('chapter records persist but the current practice position does not (documented limitation)', async () => {
    const dbName = `practice-position-${crypto.randomUUID()}`;
    let { el, store } = await mount(dbName);
    await startSection(el, 'T1A');
    for (let n = 0; n < 3; n++) {
      const qc = await card(el);
      qc.shadowRoot!.querySelector<HTMLButtonElement>('button.choice')!.click();
      await until(async () => (await store.bankRecords('us-tech')).length === n + 1, 'practice save');
      await qc.updateComplete;
      qc.shadowRoot!.querySelector<HTMLButtonElement>('button.next')!.click();
      await el.updateComplete;
    }
    const interruptedQuestion = (await card(el)).question!.id;
    const before = await store.exportAll();
    await unmount(el, store);
    ({ el, store } = await mount(dbName));
    expect(await store.exportAll()).toEqual(before);
    await startSection(el, 'T1A');
    expect((await card(el)).question!.id).toBe(US_TECH[0]!.id);
    expect((await card(el)).question!.id).not.toBe(interruptedQuestion);
  });

  it('restores an already-answered exam question visibly and prevents a different displayed answer', async () => {
    const dbName = `answered-position-${crypto.randomUUID()}`;
    let { el, store } = await mount(dbName);
    await tab(el, 2);
    let exam = el.shadowRoot!.querySelector('exam-session')!;
    await button(exam, 'Start the exam');
    let qc = await card(el);
    const original = qc.question!.correctIndex;
    qc.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.choice')[original]!.click();
    await until(async () => (await store.loadExamSession('us-tech'))?.position === 1, 'answer saved');
    await button(exam, '← Previous');
    await until(async () => (await store.loadExamSession('us-tech'))?.position === 0, 'previous saved');
    const before = await store.exportAll();
    await unmount(el, store);
    ({ el, store } = await mount(dbName));
    await tab(el, 2);
    qc = await card(el);
    expect(await store.exportAll()).toEqual(before);
    expect.soft(qc.shadowRoot!.querySelectorAll('button.choice.picked')).toHaveLength(1);
    const alternate = (original + 1) % 4;
    qc.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.choice')[alternate]!.click();
    await qc.updateComplete;
    const picked = [...qc.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.choice')]
      .findIndex(b => b.classList.contains('picked'));
    const saved = (await store.loadExamSession('us-tech'))!.answers[0];
    expect(picked, 'visible answer must match saved answer').toBe(saved);
  });

  it('switching banks during an active exam shows the other bank intro or its own saved session', async () => {
    const { el, store } = await mount(`switch-exam-${crypto.randomUUID()}`);
    await tab(el, 2);
    const exam = el.shadowRoot!.querySelector('exam-session')!;
    await button(exam, 'Start the exam');
    const qc = await card(el);
    qc.shadowRoot!.querySelector<HTMLButtonElement>('button.choice')!.click();
    await until(async () => (await store.loadExamSession('us-tech'))?.position === 1, 'exam answer save');
    await select(el, 'ca-basic');
    await exam.updateComplete;
    expect(await store.loadExamSession('us-tech')).not.toBeNull();
    expect(exam.shadowRoot!.querySelector('.intro'), 'fresh bank should have intro, not an old unresolved paper').not.toBeNull();
  });
});
