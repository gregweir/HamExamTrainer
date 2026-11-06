import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import syllabusData from '../data/us-tech-syllabus.json';
import '../components/exam-shell.js';
import type { ExamShell } from '../components/exam-shell.js';
import { ProgressStore } from '../lib/progress.js';

describe('exam-shell', () => {
  it('renders the brand bar (logo + full name) and the bank chooser with v1 banks', async () => {
    const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
    await el.updateComplete;
    const text = el.shadowRoot!.textContent!;
    expect(text).toContain('Tartanleaf Ham Exam Trainer');
    const options = [...el.shadowRoot!.querySelectorAll('select.bank-chooser option')] as HTMLOptionElement[];
    expect(options.map(o => o.value)).toEqual(expect.arrayContaining(['us-tech', 'ca-basic']));
    expect(el.shadowRoot!.querySelector('img.brand-logo')).not.toBeNull();
  });

  describe('exam-bank selection persistence', () => {
    it('restores the stored bank on mount (ca-basic stored → the CA home renders, untouched other banks)', async () => {
      const store = new FreshStore();
      // this is a "reload": the store (IndexedDB) carries the last selection
      await store.setSetting('bank', 'ca-basic');
      const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
      el.progress = store;
      const cl = await waitForBank(el, 'ca-basic', 'B-001');
      expect(el.shadowRoot!.textContent).toContain('ISED Basic question bank'); // restored, not US
      expect((cl as any).blocks[0].id).toBe('B-001');
      // and its own progress is independent: an unrelated us-tech record stays stored
      const { US_TECH } = await import('../data/exam-banks.js');
      const { contentIdentityFromQuestion } = await import('../lib/ident.js');
      await store.recordAnswer(contentIdentityFromQuestion(US_TECH[0]!), false, 1000);
      const ca = await store.recordsFor('ca-basic');
      const us = await store.recordsFor('us-tech');
      expect(us.map(r => r.identity)).toContain(contentIdentityFromQuestion(US_TECH[0]!));
      expect(ca).toHaveLength(0);
      void cl;
    });

    it('falls back to the default when the stored selection is invalid, then keeps working', async () => {
      const store = new FreshStore();
      await store.setSetting('bank', 'ca-bogus');
      const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
      el.progress = store;
      const cl = await waitForBank(el, 'us-tech', 'T1');
      expect(el.shadowRoot!.textContent).toContain('NCVEC Technician pool'); // untouched default
      expect((cl as any).blocks[0].id).toBe('T1');
    });

    it('falls back safely when the preference store is inaccessible', async () => {
      const store = new FreshStore();
      store.breakSettings = true;
      const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
      el.progress = store;
      const cl = await waitForBank(el, 'us-tech', 'T1');
      expect(el.shadowRoot!.textContent).toContain('NCVEC Technician pool');
      expect((cl as any).blocks.length).toBeGreaterThanOrEqual(1);
    });

    it('storing a choice happens the moment the chooser is used (survives a reload)', async () => {
      const store = new FreshStore();
      const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
      el.progress = store;
      await waitForBank(el, 'us-tech', 'T1');
      const sel = el.shadowRoot!.querySelector('select.bank-chooser') as HTMLSelectElement;
      sel.value = 'ca-advanced';
      sel.dispatchEvent(new Event('change'));
      await waitForBank(el, 'ca-advanced', 'A-001');
      expect(await store.getSetting<string>('bank', '')).toBe('ca-advanced');
      expect(el.shadowRoot!.textContent).toContain('ISED Advanced question bank');
      // simulate a reload with the same store
      const el2 = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
      (el2 as any).progress = store;
      await waitForBank(el2, 'ca-advanced', 'A-001');
      expect(el2.shadowRoot!.textContent).toContain('ISED Advanced question bank');
    });

    it('a restore resolving after a manual pick never clobbers the manual pick', async () => {
      const store = new FreshStore();
      await store.setSetting('bank', 'ca-basic');
      // hold getSetting in the air until the test lets it go
      let releaseGet: (v: string) => void = () => {};
      const gate = new Promise<string>(res => { releaseGet = res; });
      (store as any).getSetting = async (_k: string, _f: unknown) => gate as unknown as string;
      const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
      el.progress = store;
      await el.updateComplete;
      const sel = el.shadowRoot!.querySelector('select.bank-chooser') as HTMLSelectElement;
      sel.value = 'us-extra';
      sel.dispatchEvent(new Event('change'));
      await el.updateComplete;
      releaseGet('ca-basic'); // the pending restore resolves AFTER the manual pick
      await el.updateComplete;
      await new Promise(r => setTimeout(r, 30));
      expect(el.shadowRoot!.textContent).toContain('NCVEC Extra pool'); // manual pick stands
    });
  });

  it('Practice tab lists the bank sections (chapter list); book CTA links present', async () => {
    const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
    await el.updateComplete;
    const cl = await waitForChapterList(el);
    expect(cl).not.toBeNull();
    expect(el.shadowRoot!.querySelector('book-cta')).not.toBeNull();
  });

  it('starting a section shows the question card with that bank+section’s first question', async () => {
    const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
    await el.updateComplete;
    const cl = await waitForChapterList(el);
    cl!.dispatchEvent(new CustomEvent('section-start', { detail: { section: 'T1A' } }));
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector('question-card')!;
    expect((card as any).question?.section).toBe('T1A');
    // answering advances and records progress
    await new Promise(r => setTimeout(r, 0));
    const choices = [...card.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.choice')];
    choices[0]!.click();
    await card.updateComplete;
    const next = card.shadowRoot!.querySelector('button.next') as HTMLButtonElement;
    next.click();
    await el.updateComplete;
    expect(((card as any).question as { id: string }).id).not.toBe('T1A01');
  });

  it('the chapter list shows REAL per-section progress from the store (no fake zeros)', async () => {
    const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
    await el.updateComplete;
    const { US_TECH } = await import('../data/exam-banks.js');
    const { contentIdentityFromQuestion } = await import('../lib/ident.js');
    // isolate this test's records: a fresh, uniquely-named store
    // (the component's default store shares its db across test fixtures)
    const { ProgressStore } = await import('../lib/progress.js');
    const store = new ProgressStore(`test-shell-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    el.progress = store;
    await waitForChapterList(el);
    // seed the store: two real T1B questions studied, one of them correctly
    const t1b = US_TECH.filter(q => q.section === 'T1B');
    await store.recordAnswer(contentIdentityFromQuestion(t1b[0]!), true, 1000);
    await store.recordAnswer(contentIdentityFromQuestion(t1b[1]!), false, 1000);
    // return to the pick view (view object changes → the shell reloads stats)
    el.view = { kind: 'practice-pick' };
    // the stats load is async — wait for it to reflect the store
    const read = async (): Promise<{ block: any; subsection: any }> => {
      await el.updateComplete;
      const cl = el.shadowRoot!.querySelector('chapter-list');
      // US banks group their syllabus groups under the subelement (T1B → T1)
      const block = (cl as any)?.blocks?.find((b: any) => b.id === 'T1');
      return { block, subsection: block?.subsections?.find((s: any) => s.id === 'T1B') };
    };
    let result: { block: any; subsection: any };
    for (let i = 0; i < 60; i++) {
      result = await read();
      if (result.subsection?.studied === 2) break;
      await new Promise(r => setTimeout(r, 10));
    }
    expect(result!.subsection, 'T1B row carries store-derived stats').toBeTruthy();
    expect(result!.block.title, 'the T1 subelement header carries its NCVEC name').toBe(US_TECH_GROUPS.get('T1'));
    expect(result!.subsection.title, 'US tile carries its official group name').toBe(US_TECH_GROUPS.get('T1B'));
    expect(result!.subsection.studied, 'T1B studied count comes from the store').toBe(2);
    expect(result!.subsection.correct).toBe(1);
  });

  it('counts all official rows covered when content-identical rows share one progress record', async () => {
    const { CA_BASIC, BANKS } = await import('../data/exam-banks.js');
    const { contentIdentityFromQuestion } = await import('../lib/ident.js');
    const store = new FreshStore();
    for (const question of CA_BASIC) {
      await store.recordAnswer(contentIdentityFromQuestion(question), true, Date.now());
    }
    const records = await store.recordsFor('ca-basic');
    expect(records).toHaveLength(983);
    expect(records.reduce((sum, record) => sum + record.attempts, 0)).toBe(984);

    const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
    el.progress = store;
    (el as any).bankTouched = true;
    el.bank = BANKS.find(bank => bank.id === 'ca-basic')!;
    for (let i = 0; i < 60; i++) {
      await el.updateComplete;
      if (el.sectionStats.reduce((sum, stat) => sum + stat.studied, 0) === 984) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(el.sectionStats.reduce((sum, stat) => sum + stat.studied, 0)).toBe(984);
    expect(records.find(record => record.attempts === 2)?.attempts).toBe(2);
  });
});

const syllabus = syllabusData as { subelements: Record<string, string>; groups: Record<string, string> };
const US_TECH_GROUPS = new Map(
  [...Object.entries(syllabus.groups), ...Object.entries(syllabus.subelements)],
);

/** The block/section stats load asynchronously — wait until the chapter list carries data. */
async function waitForChapterList(el: ExamShell): Promise<any> {
  for (let i = 0; i < 60; i++) {
    const cl = el.shadowRoot!.querySelector('chapter-list');
    if (cl && (((cl as any).blocks?.length ?? 0) > 0)) return cl;
    await new Promise(r => setTimeout(r, 10));
    await el.updateComplete;
  }
  throw new Error('chapter-list with sections never rendered');
}

/** Wait for both the selected bank and its asynchronously rebuilt chapter blocks. */
async function waitForBank(el: ExamShell, bankId: string, firstBlock: string): Promise<any> {
  for (let i = 0; i < 60; i++) {
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('select.bank-chooser') as HTMLSelectElement | null;
    const list = el.shadowRoot!.querySelector('chapter-list') as any;
    if (el.bank.id === bankId && select?.value === bankId && list?.blocks?.[0]?.id === firstBlock) return list;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`bank ${bankId} with chapter block ${firstBlock} never rendered`);
}

/** A real ProgressStore on a fresh named DB for full test isolation. */
class FreshStore extends ProgressStore {
  breakSettings = false;
  constructor() {
    super(`test-shell-persist-${Math.random().toString(36).slice(2)}`);
  }
  override getSetting<T>(_key: string, fallback: T): Promise<T> {
    if (this.breakSettings) return Promise.reject(new Error('settings store inaccessible'));
    return super.getSetting(_key, fallback);
  }
  async recordsFor(bank: string) {
    return this.bankRecords(bank);
  }
}
