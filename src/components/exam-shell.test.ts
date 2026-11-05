import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import syllabusData from '../data/us-tech-syllabus.json';
import '../components/exam-shell.js';
import type { ExamShell } from '../components/exam-shell.js';

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
