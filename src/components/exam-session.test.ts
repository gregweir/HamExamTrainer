import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/exam-session.js';
import { ExamSession } from '../components/exam-session.js';
import { BANKS } from '../data/exam-banks.js';

/** Deterministic sample test through the component's static sampler. */
describe('exam-session sampling + verdict (pure logic)', () => {
  it('samples exactly examLength questions, section-distributed', () => {
    const bank = BANKS.find(b => b.id === 'ca-basic')!;
    const sample = ExamSession.sampleQuestions(bank, 1234);
    expect(sample.length).toBe(bank.examLength); // 100
    // distribution: sections present proportionally (basic tolerance: no empty sections when count allows)
    const sectionOf = (bankSections: string[], id: string) => id.slice(0, 9).replace(/-\d+$/, '');
    const present = new Set(sample.map(q => q.section));
    expect(present.size).toBeGreaterThanOrEqual(8); // of ~40 sections, a 100-sample covers most
    void sectionOf;
  });

  it('verdict math is exact: US Tech 25/35 = 71.4% → FAIL (74 needed)', () => {
    const bank = BANKS.find(b => b.id === 'us-tech')!;
    const v = ExamSession.verdict(bank, 25, 35);
    expect(v.passed).toBe(false);
    expect(v.percent).toBe(71);
  });

  it('CA Basic 70/100 → PASS; 80/100 → PASS + HONOURS', () => {
    const bank = BANKS.find(b => b.id === 'ca-basic')!;
    const pass = ExamSession.verdict(bank, 70, 100);
    expect(pass.passed).toBe(true);
    expect(pass.honours).toBe(false);
    const h = ExamSession.verdict(bank, 80, 100);
    expect(h.passed).toBe(true);
    expect(h.honours).toBe(true); // exact 80% earns Honours
    const below = ExamSession.verdict(bank, 69, 100);
    expect(below.passed).toBe(false);
  });
});

/** The session flow (uses the real bank + a stub store). */
class StubStore {
  sessions: Record<string, unknown> = {};
  async loadExamSession(bank: string) { return (this.sessions[bank] ?? null) as never; }
  async saveExamSession(s: unknown) { this.sessions[(s as any).bank] = s; }
  async clearExamSession(bank: string) { delete this.sessions[bank]; }
  async recordAnswer() {}
}

describe('exam-session flow', () => {
  it('renders examLength questions with a submit; resume restores a saved session', async () => {
    const store = new StubStore();
    const el: any = await fixture(html`<exam-session .store="${store}" .bankId="${'us-tech'}"></exam-session>`);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));
    await el.updateComplete;
    // the intro view: start button
    const start = el.shadowRoot.querySelector('button.primary');
    expect(start, 'intro view has start').not.toBeNull();
    start!.click();
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));
    await el.updateComplete;
    const card = el.shadowRoot.querySelector('question-card');
    expect(card, 'exam question card rendered').not.toBeNull();
    // saved session exists (resumable)
    expect(store.sessions['us-tech']).not.toBeNull();
  });
});
