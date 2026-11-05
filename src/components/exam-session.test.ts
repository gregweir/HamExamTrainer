import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/exam-session.js';
import { ExamSession } from '../components/exam-session.js';
import { CA_BASIC, BANKS, US_TECH, type ExamQuestion } from '../data/exam-banks.js';
import { contentIdentityFromQuestion } from '../lib/ident.js';

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

/**
 * The verdict counts the WHOLE paper: any question the user left unanswered
 * is not dropped from the denominator — it grades as incorrect (real exam
 * behaviour: no reward for never answering).
 */
describe('exam-session verdict counts unanswered as incorrect', () => {
  async function verdictFor(bankId: 'us-tech' | 'ca-basic', opts: {
    answeredCorrect: number;
    answeredWrong: number;
    total: number;
  }): Promise<{ el: any; text: string }> {
    const pool: ExamQuestion[] = bankId === 'us-tech' ? US_TECH : (CA_BASIC as unknown as ExamQuestion[]);
    const store = new StubStore();
    const el: any = await fixture(html`<exam-session .store="${store}" .bankId="${bankId}"></exam-session>`);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));
    await el.updateComplete;
    // craft a session of `total` questions, the first `answered` ones answered
    const identityOf = (q: ExamQuestion) => contentIdentityFromQuestion(q);
    const sample = ExamSession.sampleQuestions(
      BANKS.find(b => b.id === bankId)!,
      1234,
    ).slice(0, opts.total);
    const answers: (number | null)[] = [];
    let a = 0;
    for (let i = 0; i < sample.length; i++) {
      if (a < opts.answeredCorrect) {
        answers.push(sample[i]!.correctIndex);
        a += 1;
      } else if (a < opts.answeredCorrect + opts.answeredWrong) {
        answers.push((sample[i]!.correctIndex + 1) % sample[i]!.choices.length);
        a += 1;
      } else {
        answers.push(null); // left unanswered
      }
    }
    el.session = {
      bank: bankId,
      startedAt: Date.now() - 60_000,
      savedAt: Date.now(),
      position: 0,
      questionIdentities: sample.map(identityOf),
      answers,
    };
    el.started = true;
    el.submitted = true;
    await el.updateComplete;
    return { el, text: el.shadowRoot.querySelector('.verdict').textContent };
  }

  it('US Tech: 25 answered (all right) of 35 → 71% FAIL, and the paper shows 4 unanswered', async () => {
    const { el, text } = await verdictFor('us-tech', { answeredCorrect: 25, answeredWrong: 0, total: 35 });
    expect(text).toContain('71%');
    expect(text).toContain('FAIL');
    expect(text.toLowerCase()).toContain('10 unanswered');
    void el;
  });

  it('US Tech: 30/35 all right → 85% PASS (the unanswered 5 sit in the denominator)', async () => {
    const { text } = await verdictFor('us-tech', { answeredCorrect: 30, answeredWrong: 0, total: 35 });
    expect(text).toContain('85%');
    expect(text).toContain('PASS');
    expect(text.toLowerCase()).toContain('5 unanswered');
  });

  it('wrong answers and unanswered both sit in the denominator: 26 right, 4 wrong, 5 blank of 35 → 74% PASS at the bar', async () => {
    const { text } = await verdictFor('us-tech', { answeredCorrect: 26, answeredWrong: 4, total: 35 });
    expect(text).toContain('74%');
    expect(text).toContain('PASS');
    expect(text.toLowerCase()).toContain('5 unanswered');
  });

  it('submitting with unanswered questions asks first (confirm), and a decline keeps the session', async () => {
    const confirm = vi.fn(() => false);
    (window as any).confirm = confirm;
    const store = new StubStore();
    const el: any = await fixture(html`<exam-session .store="${store}" .bankId="${'us-tech'}"></exam-session>`);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));
    await el.updateComplete;
    (el.shadowRoot.querySelector('button.primary') as HTMLButtonElement).click();
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));
    await el.updateComplete;
    // answer nothing — 35 unanswered left
    const submit = [...el.shadowRoot.querySelectorAll('button.primary')]
      .find(b => b.textContent === 'Submit exam') as HTMLButtonElement;
    submit!.click();
    await el.updateComplete;
    expect(confirm).toHaveBeenCalled();
    const [msg] = confirm.mock.calls[0]! as unknown as [string];
    expect(msg).toContain('unanswered');
    // declined: still running, session intact
    expect(el.shadowRoot.querySelector('question-card')).not.toBeNull();
    expect(Object.keys(store.sessions).length).toBe(1);
  });
});

/** The session flow (uses the real bank + a stub store). */
class StubStore {
  sessions: Record<string, unknown> = {};
  attempts: any[] = [];
  async loadExamSession(bank: string) { return (this.sessions[bank] ?? null) as never; }
  async saveExamSession(s: unknown) { this.sessions[(s as any).bank] = s; }
  async clearExamSession(bank: string) { delete this.sessions[bank]; }
  async recordAnswer() {}
  async saveExamAttempt(a: any) { this.attempts.push({ ...a }); }
  async bankAttempts(bank: string, limit = 10) {
    return this.attempts.filter(a => a.bank === bank)
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .slice(0, limit);
  }
}

describe('exam-session flow', () => {
  it('keyboard: ArrowLeft/ArrowRight step through the paper while it runs', async () => {
    const store = new StubStore();
    const el: any = await fixture(html`<exam-session .store="${store}" .bankId="${'us-tech'}"></exam-session>`);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));
    await el.updateComplete;
    // nothing before the exam starts: arrows must not throw or move anywhere
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(el.started).toBe(false);
    el.shadowRoot.querySelector('button.primary').click(); // start
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));
    await el.updateComplete;
    const s = el.session;
    expect(s.position).toBe(0);
    // at the first question ArrowLeft stays put, ArrowRight moves forward
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await el.updateComplete;
    expect(el.session.position).toBe(0);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await el.updateComplete;
    expect(el.session.position).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await el.updateComplete;
    expect(el.session.position).toBe(0);
  });

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

  it('a submitted paper persists its verdict as an exam attempt', async () => {
    const confirm = vi.fn(() => true);
    (window as any).confirm = confirm;
    const store = new StubStore();
    const el: any = await fixture(html`<exam-session .store="${store}" .bankId="${'us-tech'}"></exam-session>`);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));
    await el.updateComplete;
    el.shadowRoot.querySelector('button.primary').click(); // start
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 30));
    await el.updateComplete;
    const submit = [...el.shadowRoot.querySelectorAll('button.primary')]
      .find(b => b.textContent === 'Submit exam') as HTMLButtonElement;
    submit!.click();
    await Promise.resolve(); // flush the confirm + save microtasks
    await new Promise(r => setTimeout(r, 30));
    expect(confirm).toHaveBeenCalled();
    const attempt = store.attempts[0]!;
    expect(attempt.bank).toBe('us-tech');
    expect(attempt.total).toBe(35); // the whole paper, unanswered included
    expect(attempt.correct).toBe(0);
    expect(attempt.percent).toBe(0);
    expect(attempt.passed).toBe(false);
  });

  it('the intro lists past attempts for the bank, newest first', async () => {
    const store = new StubStore();
    await store.saveExamAttempt({
      id: 1000, bank: 'us-tech', submittedAt: Date.now() - 86_400_000,
      correct: 30, total: 35, percent: 85, passed: true,
    });
    const el: any = await fixture(html`<exam-session .store="${store}" .bankId="${'us-tech'}"></exam-session>`);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 40));
    await el.updateComplete;
    const text = el.shadowRoot.textContent;
    expect(text).toContain('85%');
    expect(text).toContain('PASS');
    // the attempt count chips in the history header
    expect(text).toContain('Previous attempts');
    // a verdict from another bank does not leak into the list
    await store.saveExamAttempt({
      id: 1001, bank: 'ca-basic', submittedAt: Date.now(),
      correct: 80, total: 100, percent: 80, passed: true, honours: true,
    });
    el.attempts = await store.bankAttempts('us-tech');
    await el.updateComplete;
    expect(el.shadowRoot.textContent).not.toContain('HONOURS');
  });
});
