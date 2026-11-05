import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import logoUrl from '../assets/logo.jpg';
import {
  BANKS,
  CA_ADVANCED,
  CA_BASIC,
  US_EXTRA,
  US_GENERAL,
  US_TECH,
  type BankDefinition,
  type ExamQuestion,
} from '../data/exam-banks.js';
import { initialThemeMode, cycleThemeMode } from '../lib/theme.js';
import { ProgressStore } from '../lib/progress.js';
import { nextSchedule } from '../lib/sm2.js';
import { contentIdentityFromQuestion } from '../lib/ident.js';
import { bankBlock, sectionTitle, subsectionTitle, subelementTitle } from '../data/exam-banks.js';
import './question-card.js';
import './chapter-list.js';
import './book-cta.js';
import './review-session.js';
import './exam-session.js';
import './install-dialog.js';
import type { SubjectBlock, SubsectionStat } from './chapter-list.js';

type Tab = 'practice' | 'review' | 'exam';
type View =
  | { kind: 'practice-pick' }
  | { kind: 'practice'; questions: ExamQuestion[]; index: number; section: string };

/** EN study view per bank (CA banks carry the FR data separately; EN is keyed). */
const bankData: Partial<Record<BankDefinition['id'], ExamQuestion[]>> = {
  'us-tech': US_TECH,
  'us-general': US_GENERAL,
  'us-extra': US_EXTRA,
  'ca-basic': CA_BASIC as unknown as ExamQuestion[],
  'ca-advanced': CA_ADVANCED as unknown as ExamQuestion[],
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
  /** Per-section progress for the chapter list (loaded from the store, async). */
  @state() accessor sectionStats: SubsectionStat[] = [];
  @state() accessor blocks: SubjectBlock[] = [];

  updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    // Real per-section progress: the chapter list must never show fake zeros
    // once the user has studied. Load on every change that can move a record
    // (bank switch, view back to the pick screen) — recordAnswer fires after
    // leaving the pick view, so re-entering it is the refresh point.
    if (
      changed.has('bank') ||
      (changed.has('view') && this.view.kind === 'practice-pick')
    ) {
      void this.refreshSectionStats();
    }
  }

  private async refreshSectionStats(): Promise<void> {
    const bank = this.bank;
    if (!bank) return;
    const questions = bankData[bank.id] ?? [];
    const sectionOf = new Map<string, string>(questions.map(q => [contentIdentityFromQuestion(q), q.section]));
    const totals = new Map<string, SubsectionStat>(
      bank.sections.map(id => [id, { id, total: questions.filter(q => q.section === id).length, studied: 0, correct: 0 }]),
    );
    const records = await this.progress.bankRecords(bank.id);
    for (const r of records) {
      const stat = totals.get(sectionOf.get(r.identity) ?? '');
      if (!stat) continue;
      stat.studied += 1;
      if (r.correctCount > 0) stat.correct += 1;
    }
    // ignore a stale load (the bank changed while awaiting)
    if (this.bank === bank) {
      this.sectionStats = bank.sections.map(id => totals.get(id)!);
      // two-level view: CA banks group subsections under their subject
      // block; US banks group their syllabus groups under the NCVEC
      // subelement (T1A → T1 "COMMISSION'S RULES").
      const isCa = bank.id.startsWith('ca');
      const blockIdOf = (id: string) => (isCa ? id.slice(0, 5) : id.slice(0, 2));
      const blockTitleOf = (id: string) =>
        isCa
          ? bankBlock(bank.id, blockIdOf(id)) ?? null
          : subelementTitle(bank.id, blockIdOf(id));
      const subTitleOf = (id: string) =>
        isCa ? subsectionTitle(bank.id, id) ?? undefined : sectionTitle(bank.id, id);
      this.blocks = bank.sections.reduce<SubjectBlock[]>((acc, id) => {
        const blockId = blockIdOf(id);
        const title = blockTitleOf(id) ?? sectionTitle(bank.id, blockId);
        const stat = { ...totals.get(id)!, title: subTitleOf(id) };
        const last = acc[acc.length - 1];
        if (last && last.id === blockId) last.subsections.push(stat);
        else acc.push({ id: blockId, title, subsections: [stat] });
        return acc;
      }, []);
    }
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--tl-bg, #f4efe5);
      color: var(--tl-text, #173847);
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

    .mode-btn {
      background: transparent;
      color: var(--tl-cream, #f4efe5);
      border: 1px solid rgba(244, 239, 229, 0.3);
      border-radius: 8px;
      font-size: 15px;
      padding: 6px 10px;
      cursor: pointer;
    }

    .mode-btn:hover { border-color: var(--tl-coral, #f58a6a); color: var(--tl-coral, #f58a6a); }
    .mode-btn:focus-visible { outline: 3px solid var(--tl-coral, #f58a6a); outline-offset: 2px; }

    .bank-chooser {
      margin-left: auto;
      background: var(--tl-chrome-bg, #255665);
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
      background: var(--tl-chrome-bg, #255665);
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
      background: var(--tl-choice-bg, #1d4258);
      color: var(--tl-accent-alt, #f58a6a);
      font-weight: 600;
    }

    .content {
      max-width: 780px;
      margin: 0 auto;
      padding: 20px 22px 60px;
    }

    .home-head {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 14px;
    }

    .ready {
      display: flex;
      align-items: baseline;
      gap: 10px;
      background: var(--tl-surface, #fff);
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 10px;
      padding: 10px 18px;
      font-family: var(--font-mono, monospace);
    }

    .ready-num {
      font-size: 22px;
      font-weight: 700;
      color: var(--tl-teal, #2f5e5b);
    }

    .ready-label {
      font-size: 11px;
      color: var(--tl-text-muted, #6b7280);
    }

    .placeholder {
      color: var(--tl-text-muted, #255665);
      font-size: 14px;
    }

    .session-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: var(--tl-text-muted, #255665);
    }

    button.back {
      background: none;
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 13px;
      cursor: pointer;
      color: var(--tl-text, #173847);
    }
    button.back:focus-visible { outline: 3px solid var(--tl-teal, #2f5e5b); outline-offset: 2px; }

    .done-note {
      text-align: center;
      padding: 30px 10px;
      font-size: 15px;
      color: var(--tl-text-muted, #255665);
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
        <img class="brand-logo" src="${logoUrl}" alt="Tartanleaf">
        <div>
          <div class="brand-name">Tartanleaf Ham Exam Trainer</div>
          <div class="brand-sub">${this.bank.subtitle}</div>
        </div>
        <button
          class="mode-btn"
          aria-label="Switch between light and dark mode"
          @click="${function () { document.documentElement.dataset.mode = cycleThemeMode(); }}"
        >◐</button>
        <button
          class="mode-btn install-btn"
          aria-label="How to install this app on your device"
          @click="${() => this.renderRoot.querySelector('install-dialog')?.show()}"
        >Install</button>
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
            @click="${() => {
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
            .bank="${this.bank.id}"
            .resolveQuestion="${(identity: string) => this.resolveQuestion(identity)}"
          ></review-session>
        ` : html`
          <exam-session
            .store="${this.progress}"
            .bankId="${this.bank.id}"
          ></exam-session>
        `}
      </div>
      <book-cta
        .bookHref="${this.bank.bookCta.href}"
        .bookLabel="${this.bank.bookCta.label}"
      ></book-cta>
      <install-dialog></install-dialog>
    `;
  }

  private renderPractice(): unknown {
    const v = this.view;
    if (v.kind === 'practice-pick') {
      // block/section stats load asynchronously from the store — while empty
      // (no data yet) the chapter list renders nothing: never fake zeros.
      const total = this.bank.questionCount;
      const seen = [...this.sectionStats.values()].reduce((a, b) => a + b.studied, 0);
      const readiness = Math.round((seen / total) * 100);
      return html`
        <div class="home-head">
          <div class="ready" role="status">
            <span class="ready-num">${readiness}%</span>
            <span class="ready-label">ready · ${seen} of ${total} questions studied</span>
          </div>
        </div>
        <chapter-list
        .blocks="${this.blocks}"
        @section-start="${(e: CustomEvent) => {
          const section = e.detail.section;
          const qs = (bankData[this.bank.id] ?? []).filter(q => q.section === section);
          this.view = { kind: 'practice', questions: qs, index: 0, section };
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
