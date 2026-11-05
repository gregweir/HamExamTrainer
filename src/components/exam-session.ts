import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  BANKS,
  CA_BASIC,
  US_TECH,
  type BankDefinition,
  type ExamQuestion,
} from '../data/exam-banks.js';
import type { ProgressStore, ExamSession as StoredSession } from '../lib/progress.js';
import { contentIdentityFromQuestion } from '../lib/ident.js';
import './question-card.js';

/** Bank questions by id (the shipped v1 banks; parked banks resolve empty). */
const bankQuestions: Partial<Record<BankDefinition['id'], ExamQuestion[]>> = {
  'us-tech': US_TECH,
  'ca-basic': CA_BASIC as unknown as ExamQuestion[],
};

/** Deterministic mulberry32 RNG for seeded samples. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function identityOf(q: ExamQuestion): string {
  return contentIdentityFromQuestion(q);
}

/**
 * Mock exam: examLength questions drawn section-distributed by a seeded RNG,
 * exam-like presentation (feedback withheld until submission), resumable
 * across reloads (the session persists in the ProgressStore), and the exact
 * jurisdiction verdict: percent vs the bank's passPercent + Honours where
 * the bank defines honoursPercent.
 */
@customElement('exam-session')
export class ExamSession extends LitElement {
  @property({ type: Object }) store: ProgressStore | null = null;
  @property({ type: String }) bankId = '';

  @state() bank: BankDefinition | null = null;
  @state() session: StoredSession | null = null;
  @state() submitted = false;
  @state() started = false;

  static styles = css`
    :host {
      display: block;
      font-family: var(--font-body, system-ui, sans-serif);
      color: var(--tl-text, #173847);
    }

    .intro {
      text-align: center;
      background: var(--tl-surface, #fff);
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 12px;
      padding: 34px 20px;
    }

    .intro h2 { margin: 0 0 10px; font-size: 20px; }
    .intro p { margin: 0 0 22px; color: var(--tl-text-muted, #255665); font-size: 14px; line-height: 1.5; }
    .intro .resume-note { color: var(--tl-coral, #f58a6a); }

    button.primary {
      background: var(--tl-teal, #2f5e5b);
      color: var(--tl-cream, #f4efe5);
      border: none;
      border-radius: 8px;
      padding: 12px 30px;
      font-size: 15px;
      cursor: pointer;
      font-family: inherit;
    }
    button.primary:disabled { opacity: 0.45; cursor: not-allowed; }
    button.primary:focus-visible { outline: 3px solid var(--tl-navy, #173847); outline-offset: 2px; }

    .bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      font-family: var(--font-mono, monospace);
      font-size: 13px;
      color: var(--tl-text-muted, #255665);
    }

    question-card { margin-bottom: 12px; }

    .verdict {
      text-align: center;
      background: var(--tl-surface, #fff);
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 12px;
      padding: 30px 20px;
    }

    .verdict .big {
      font-size: 30px;
      font-weight: 800;
      margin-bottom: 4px;
    }
    .verdict .pass { color: #2f8f4e; }
    .verdict .fail { color: #c74e31; }

    .honours {
      margin-top: 10px;
      display: inline-block;
      background: var(--tl-bar-bg);
      color: var(--tl-text, #173847);
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 13px;
      font-weight: 700;
    }

    .unanswered {
      margin-top: 6px;
      color: #c74e31;
      font-size: 13px;
    }

    table.breakdown {
      margin: 18px auto 0;
      border-collapse: collapse;
      font-size: 13px;
    }
    table.breakdown td, table.breakdown th {
      border-bottom: 1px solid var(--tl-border, #e5e0d5);
      padding: 6px 16px;
      text-align: left;
      font-family: var(--font-mono, monospace);
    }
  `;

  /* ------------------------- static pure logic ------------------------- */

  /** Sample `bank.examLength` questions distributed across `sections`. */
  static sampleQuestions(bank: BankDefinition, seed: number): ExamQuestion[] {
    const questions = bankQuestions[bank.id] ?? [];
    const bySection = new Map<string, ExamQuestion[]>();
    for (const q of questions) {
      const list = bySection.get(q.section) ?? [];
      list.push(q);
      bySection.set(q.section, list);
    }
    const sections = bank.sections.filter(s => (bySection.get(s) ?? []).length > 0);
    if (sections.length === 0) return [];

    const rand = rng(seed);
    // proportional quota per section, largest-remainder rounding to hit the total exactly
    const quotas = sections.map(s => {
      const pool = (bySection.get(s) ?? []).length;
      const exact = (bank.examLength * pool) / questions.length;
      return Math.floor(exact);
    });
    let assigned = quotas.reduce((a, b) => a + b, 0);
    const byRemainder = sections
      .map((s, i) => ({ i, rem: (bank.examLength * (bySection.get(s) ?? []).length) / questions.length - (quotas[i] ?? 0) }))
      .sort((a, b) => b.rem - a.rem);
    let r = 0;
    while (assigned < bank.examLength && byRemainder.length) {
      const target = byRemainder[r % byRemainder.length]!.i;
      quotas[target] = (quotas[target] ?? 0) + 1;
      assigned += 1;
      r += 1;
    }

    const pick: ExamQuestion[] = [];
    sections.forEach((s, i) => {
      const pool = [...(bySection.get(s) ?? [])];
      // Fisher-Yates within the section, then take the quota
      for (let j = pool.length - 1; j > 0; j--) {
        const k = Math.floor(rand() * (j + 1));
        const tmp = pool[j]!;
        pool[j] = pool[k]!;
        pool[k] = tmp;
      }
      pick.push(...pool.slice(0, quotas[i]));
    });
    // interleave across sections: round-robin so consecutive questions differ
    const buckets = sections.map(s => pick.filter(q => q.section === s));
    const out: ExamQuestion[] = [];
    while (out.length < bank.examLength) {
      for (const b of buckets) {
        if (b.length) out.push(b.shift()!);
        if (out.length >= bank.examLength) break;
      }
      if (!buckets.some(b => b.length)) break;
    }
    return out.slice(0, bank.examLength);
  }

  /** Exact verdict math: percent (0-100, floor-truncated like real exams count) + bars. */
  static verdict(bank: BankDefinition, correct: number, total: number): {
    passed: boolean; honours: boolean; percent: number;
  } {
    const percent = total > 0 ? Math.floor((correct / total) * 100) : 0;
    return {
      percent,
      passed: percent >= bank.passPercent,
      honours: bank.honoursPercent !== undefined && percent >= bank.honoursPercent,
    };
  }

  static elapsed(from: number): string {
    const s = Math.max(0, Math.floor((Date.now() - from) / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  /* ------------------------------ component ------------------------------ */

  private identityOf = identityOf;

  updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has('bankId') || changed.has('store')) {
      this.bank = BANKS.find(b => b.id === this.bankId) ?? null;
    }
    // resume a saved session once the bank is known
    if (this.bank && !this.started && !this.submitted && (changed.has('store') || changed.has('bankId'))) {
      void this.tryResume();
    }
  }

  private async tryResume(): Promise<void> {
    const bank = this.bank;
    if (!bank || !this.store || this.started) return;
    const saved = await this.store.loadExamSession(bank.id);
    if (saved) {
      this.session = saved;
      this.started = true;
    }
  }

  private questions(): ExamQuestion[] {
    return (this.bank && bankQuestions[this.bank.id]) ?? [];
  }

  private currentQuestion(): ExamQuestion | null {
    const s = this.session;
    if (!s) return null;
    const identity = s.questionIdentities[s.position];
    if (!identity) return null;
    return this.questions().find(q => identityOf(q) === identity) ?? null;
  }

  private async startExam(): Promise<void> {
    const bank = this.bank;
    if (!bank || !this.store) return;
    const sample = ExamSession.sampleQuestions(bank, Math.floor(Math.random() * 2 ** 31));
    const session: StoredSession = {
      bank: bank.id,
      startedAt: Date.now(),
      savedAt: Date.now(),
      position: 0,
      questionIdentities: sample.map(identityOf),
      answers: new Array(sample.length).fill(null),
    };
    this.session = session;
    this.started = true;
    this.submitted = false;
    await this.store.saveExamSession(session);
  }

  /** Record the answer for the CURRENT question and advance (resume-safe). */
  private async answer(choiceIndex: number): Promise<void> {
    const s = this.session;
    if (!s || this.submitted) return;
    if (s.answers[s.position] !== null) return; // already answered (prevents overwrites)
    const answers = [...s.answers];
    answers[s.position] = choiceIndex;
    const next: StoredSession = {
      ...s,
      answers,
      position: Math.min(s.position + 1, s.questionIdentities.length - 1),
      savedAt: Date.now(),
    };
    this.session = next;
    await this.store?.saveExamSession(next);
  }

  private async moveTo(nextIndex: number): Promise<void> {
    const s = this.session;
    if (!s) return;
    this.session = { ...s, position: Math.max(0, Math.min(s.questionIdentities.length - 1, nextIndex)), savedAt: Date.now() };
    await this.store?.saveExamSession(this.session);
  }

  private async submit(): Promise<void> {
    const s = this.session;
    if (!s) return;
    // Real-exam discipline: an unfinished paper submits with a warning, and
    // anything unanswered grades as incorrect.
    const unanswered = s.answers.filter(a => a === null).length;
    if (unanswered > 0) {
      const proceed = window.confirm(
        `Submit with ${unanswered} unanswered? Unanswered questions count as incorrect.`,
      );
      if (!proceed) return;
    }
    this.submitted = true;
    await this.store?.clearExamSession(s.bank);
  }

  private async abandon(): Promise<void> {
    await this.store?.clearExamSession(this.bank?.id ?? '');
    this.started = false;
    this.session = null;
    this.submitted = false;
  }

  protected render() {
    if (!this.bank) return nothing;
    if (this.submitted && this.session) return this.renderVerdict();
    if (!this.started) {
      return html`
        <div class="intro">
          <h2>Practice exam — ${this.bank.title}</h2>
          <p>
            ${this.bank.examLength} questions drawn across the bank's topics. No
            feedback until the end — you get the same verdict the real exam gives:
            ${this.bank.passPercent}% to pass${this.bank.honoursPercent ? `, ${this.bank.honoursPercent}% for Honours` : ''}.
            You can leave and resume any time — answers are kept locally.
          </p>
          <button class="primary" @click="${() => void this.startExam()}">Start the exam</button>
        </div>
      `;
    }
    return this.renderRunning();
  }

  private renderRunning() {
    const s = this.session!;
    const answeredCount = s.answers.filter(a => a !== null).length;
    const q = this.currentQuestion();
    return html`
      <div class="bar">
        <span>Question ${s.position + 1} / ${s.questionIdentities.length}</span>
        <span>${answeredCount} answered · ${ExamSession.elapsed(s.startedAt)}</span>
        <button class="primary" @click="${() => void this.submit()}">Submit exam</button>
      </div>
      ${q ? html`
        <question-card
          .question="${q}"
          .examMode="${true}"
          @answered="${(e: CustomEvent) => void this.answer(e.detail.choiceIndex as number)}"
        ></question-card>
        <div class="bar">
          <button class="primary" ?disabled="${s.position === 0}" @click="${() => void this.moveTo(s.position - 1)}">← Previous</button>
          <button class="primary" @click="${() => void this.abandon()}">Abandon</button>
        </div>
      ` : html`<div class="bar">This question left the bank. <button class="primary" @click="${() => void this.abandon()}">Abandon</button></div>`}
    `;
  }

  private renderVerdict() {
    const bank = this.bank!;
    const s = this.session!;
    const total = s.questionIdentities.length;
    const sectionRows: Record<string, { right: number; total: number }> = {};
    let right = 0;
    let unanswered = 0;
    s.answers.forEach((a, idx) => {
      const identity = s.questionIdentities[idx]!;
      const q = this.questions().find(bq => identityOf(bq) === identity);
      if (a === null) {
        // unanswered = not counted as correct — but it already sits in `total`
        unanswered += 1;
        return;
      }
      if (!q) return; // the question left the bank; it still counts as attempted-incorrect in `total`
      const isRight = a === q.correctIndex;
      if (isRight) right += 1;
      const row = (sectionRows[q.section] ??= { right: 0, total: 0 });
      row.total += 1;
      if (isRight) row.right += 1;
    });
    const v = ExamSession.verdict(bank, right, total);
    return html`
      <div class="verdict" role="status">
        <div class="big ${v.passed ? 'pass' : 'fail'}">${Math.round(v.percent)}% — ${v.passed ? 'PASS' : 'FAIL'}</div>
        <div>${right} of ${total} correct · the bar: pass ${bank.passPercent}%${bank.honoursPercent ? `, Honours ${bank.honoursPercent}%` : ''}</div>
        ${unanswered > 0 ? html`<div class="unanswered">${unanswered} unanswered — counted as incorrect</div>` : nothing}
        ${v.honours ? html`<div class="honours">Honours — ${Math.round(v.percent)}% ≥ ${bank.honoursPercent}%</div>` : nothing}
        <table class="breakdown">
          <tr><th>Section</th><th>Correct</th><th>Of</th></tr>
          ${Object.entries(sectionRows).map(([section, r]) => html`
            <tr><td>${section}</td><td>${r.right}</td><td>${r.total}</td></tr>
          `)}
        </table>
        <p><button class="primary" @click="${() => void this.abandon()}">Done</button></p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'exam-session': ExamSession;
  }
}
