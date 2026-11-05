import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  BANKS,
  CA_BASIC,
  US_TECH,
  type BankDefinition,
  type ExamQuestion,
} from '../data/exam-banks.js';
import { ProgressStore } from '../lib/progress.js';
import { nextSchedule } from '../lib/sm2.js';
import { contentIdentityFromQuestion } from '../lib/ident.js';
import './question-card.js';
import './chapter-list.js';
import './book-cta.js';
import './review-session.js';

type Tab = 'practice' | 'review' | 'exam';
type View =
  | { kind: 'practice-pick' }
  | { kind: 'practice'; questions: ExamQuestion[]; index: number; section: string };

/** EN study view per bank (CA banks carry the FR data separately; EN is keyed). */
const bankData: Partial<Record<BankDefinition['id'], ExamQuestion[]>> = {
  'us-tech': US_TECH,
  'ca-basic': CA_BASIC as unknown as ExamQuestion[],
};

/**
 * The PWA root: brand bar + bank chooser + Practice / Review / Exam.
 * Review and Exam views arrive in later tasks; Practice runs chapter practice:
 * question card, instant feedback, progress recorded by content identity.
 */
@customElement('exam-shell')
export class ExamShell extends LitElement {
  progress = new ProgressStore();
  @state() bank: BankDefinition = BANKS[0]!;
  @state() tab: Tab = 'practice';
  @state() view: View = { kind: 'practice-pick' };

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--tl-cream, #f4efe5);
      color: var(--tl-navy, #173847);
      font-family: var(--font-body, system-ui, sans-serif);
    }

    .brandbar {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 22px;
      background: var(--tl-navy, #173847);
      color: var(--tl-cream, #f4efe5);
      flex-wrap: wrap;
    }

    img.brand-logo {
      width: 44px;
      height: 44px;
      border-radius: 8px;
    }

    .brand-name {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.2;
    }

    .brand-sub {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      opacity: 0.75;
    }

    .bank-chooser {
      margin-left: auto;
      background: var(--tl-slate, #255665);
      color: var(--tl-cream, #f4efe5);
      border: 1px solid rgba(244, 239, 229, 0.3);
      border-radius: 8px;
      font-size: 13px;
      padding: 6px 10px;
    }

    .tabs {
      display: flex;
      gap: 6px;
      padding: 10px 22px;
      background: var(--tl-slate, #255665);
    }

    button.tab {
      background: rgba(244, 239, 229, 0.08);
      border: 1px solid transparent;
      color: var(--tl-cream, #f4efe5);
      font-size: 14px;
      padding: 8px 18px;
      border-radius: 8px 8px 0 0;
      cursor: pointer;
    }

    button.tab:hover { background: rgba(244, 239, 229, 0.16); }
    button.tab:focus-visible { outline: 3px solid var(--tl-coral, #f58a6a); outline-offset: 2px; }
    button.tab[aria-selected='true'] {
      background: var(--tl-cream, #f4efe5);
      color: var(--tl-navy, #173847);
      font-weight: 600;
    }

    .content {
      max-width: 780px;
      margin: 0 auto;
      padding: 20px 22px 60px;
    }

    .placeholder {
      color: var(--tl-slate, #255665);
      font-size: 14px;
    }

    .session-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: var(--tl-slate, #255665);
    }

    button.back {
      background: none;
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 13px;
      cursor: pointer;
      color: var(--tl-navy, #173847);
    }
    button.back:focus-visible { outline: 3px solid var(--tl-teal, #2f5e5b); outline-offset: 2px; }

    .done-note {
      text-align: center;
      padding: 30px 10px;
      font-size: 15px;
      color: var(--tl-slate, #255665);
      background: var(--tl-surface, #fff);
      border-radius: 12px;
      border: 1px solid var(--tl-border, #e5e0d5);
    }

    book-cta {
      margin-top: 14px;
    }
  `;

  /* ------------------------------- render ------------------------------- */

  protected render(): unknown {
    return html`
      <div class="brandbar">
        <img class="brand-logo" src="/trainer/assets/logo.jpg" alt="Tartanleaf">
        <div>
          <div class="brand-name">Tartanleaf Ham Exam Trainer</div>
          <div class="brand-sub">${this.bank.subtitle}</div>
        </div>
        <select
          class="bank-chooser"
          aria-label="Choose an exam"
          .value="${this.bank.id}"
          @change="${(e: Event) => {
            const pick = BANKS.find(b => b.id === (e.target as HTMLSelectElement).value) ?? BANKS[0]!;
            this.bank = pick;
            this.view = { kind: 'practice-pick' };
          }}"
        >
          ${BANKS.map(b => html`<option value="${b.id}">${b.title}</option>`)}
        </select>
      </div>
      <div class="tabs" role="tablist" aria-label="Study modes">
        ${(['practice', 'review', 'exam'] as const).map(t => html`
          <button
            class="tab"
            role="tab"
            aria-selected="${this.tab === t}"
            ?disabled="${t === 'exam'}"
            title="${t === 'exam' ? 'Arriving in a later build' : ''}"
            @click="${() => {
              if (t === 'exam') return;
              this.tab = t;
              this.view = { kind: 'practice-pick' };
            }}"
          >${t[0]!.toUpperCase() + t.slice(1)}</button>
        `)}
      </div>
      <div class="content">
        ${this.tab === 'practice' ? this.renderPractice() : this.tab === 'review' ? html`
          <review-session
            .store="${this.progress}"
            .bank="${this.bank.id === 'ca-basic-honours' ? 'ca-basic' : this.bank.id}"
            .resolveQuestion="${(identity: string) => this.resolveQuestion(identity)}"
          ></review-session>
        ` : html`<div class="placeholder">Arriving in a later build.</div>`}
      </div>
      <book-cta
        .bookHref="${this.bank.bookCta.href}"
        .bookLabel="${this.bank.bookCta.label}"
      ></book-cta>
    `;
  }

  private renderPractice(): unknown {
    const v = this.view;
    if (v.kind === 'practice-pick') {
      const sections = this.bank.sections.map(id => ({
        id,
        total: (bankData[this.bank.id] ?? []).filter(q => q.section === id).length,
        studied: 0,
        correct: 0,
      }));
      return html`<chapter-list
        .sections="${sections}"
        @section-start="${(e: CustomEvent) => {
          const section = e.detail.section;
          this.view = {
            kind: 'practice',
            questions: (bankData[this.bank.id] ?? []).filter(q => q.section === section),
            index: 0,
            section,
          };
        }}"
      ></chapter-list>`;
    }
    if (v.index >= v.questions.length) {
      return html`<div class="done-note">Section ${v.section} complete — progress saved locally.</div>`;
    }
    const q = v.questions[v.index]!;
    return html`
      <div class="session-bar">
        <button class="back" @click="${() => { this.view = { kind: 'practice-pick' }; }}">← Topics</button>
        <span>${v.section} · question ${v.index + 1} / ${v.questions.length}</span>
      </div>
      <question-card
        .question="${q}"
        @answered="${(e: CustomEvent) => void this.handleAnswered(q, e.detail.correct)}"
        @next="${() => { this.view = { ...v, index: v.index + 1, questions: v.questions, section: v.section }; }}"
      ></question-card>
    `;
  }

  /* ------------------------------ practice ------------------------------ */

  private async resolveQuestion(identity: string): Promise<ExamQuestion | null> {
    return bankData[this.bank.id]?.find(q => contentIdentityFromQuestion(q) === identity) ?? null;
  }

  private async handleAnswered(q: ExamQuestion, correct: boolean): Promise<void> {
    const now = Date.now();
    const identity = contentIdentityFromQuestion(q);
    const existing = await this.progress.getRecord(identity);
    const sched = nextSchedule(
      existing ?? { ease: 2.5, intervalDays: 0, dueAt: 0, lastStudiedAt: 0 },
      correct ? 4 : 1,
      now,
    );
    await this.progress.recordAnswer(identity, correct, now, sched);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'exam-shell': ExamShell;
  }
}
