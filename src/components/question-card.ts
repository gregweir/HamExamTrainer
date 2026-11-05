import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localizeQuestion, type ExamQuestion } from '../data/exam-banks.js';
import { getLang, onLangChange, t, type Lang } from '../lib/i18n.js';
import { inFormControl, onWindowKey } from '../lib/keys.js';

/**
 * One study question: text, optional figure, four choices, instant feedback
 * (choice + explanation + references), then a Next affordance. In exam mode
 * the shell renders this element with `examMode` — feedback is suppressed
 * and selection is stored, not revealed. Set `hideNext` where the host has
 * its own advancing UI (review-session) — otherwise a dead Next button shows.
 *
 * Events:
 *  - 'answered' detail { correct: boolean, choiceIndex: number } (once per question)
 *  - 'next' (user asked to advance)
 */
@customElement('question-card')
export class QuestionCard extends LitElement {
  @property({ type: Object }) question: ExamQuestion | null = null;
  @property({ type: Boolean }) examMode = false;
  @property({ type: Boolean }) nextDisabled = false;
  /** Host has its own advancing UI — never render the card's own Next button. */
  @property({ type: Boolean }) hideNext = false;

  @state() private pickedIndex: number | null = null;
  @state() private advanceRequested = false;
  @state() private uiLang: Lang = getLang();
  private keyOff: (() => void) | null = null;
  private unsubLang?: () => void;

  static styles = css`
    :host {
      display: block;
      background: var(--tl-surface, #fff);
      color: var(--tl-text, #173847);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid var(--tl-border, #e5e0d5);
      font-family: var(--font-body, system-ui, sans-serif);
    }

    .section-tag {
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: var(--tl-text-muted, #255665);
      letter-spacing: 0.05em;
    }

    .question-text {
      font-size: 19px;
      line-height: 1.55;
      margin: 10px 0 24px;
      font-family: var(--font-question, Georgia, 'Times New Roman', serif);
    }

    .choices {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    button.choice {
      display: flex;
      gap: 12px;
      align-items: baseline;
      text-align: left;
      font-size: 15px;
      line-height: 1.45;
      padding: 12px 14px;
      border-radius: 8px;
      border: 2px solid var(--tl-border, #e5e0d5);
      background: var(--tl-choice-bg);
      color: inherit;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }

    button.choice:hover:not(:disabled) {
      border-color: var(--tl-sage, #97a28a);
    }

    button.choice:focus-visible {
      outline: 3px solid var(--tl-teal, #2f5e5b);
      outline-offset: 2px;
    }

    button.choice .key {
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: var(--tl-text-muted, #255665);
      flex: 0 0 auto;
    }

    /* The feedback fills are light paper in both themes, so the text on them
       must go dark explicitly — 'inherit' is cream under data-mode="dark". */
    button.choice.right {
      border-color: #2f8f4e;
      background: #eaf6ee;
      color: var(--tl-navy, #173847);
    }

    button.choice.wrong {
      border-color: #c74e31;
      background: #f9ece8;
      color: var(--tl-navy, #173847);
    }

    button.choice.right .key,
    button.choice.wrong .key {
      color: var(--tl-slate, #255665);
    }

    button.choice:disabled {
      cursor: default;
    }

    .feedback {
      margin-top: 20px;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 14px;
      line-height: 1.6;
      animation: settle 0.25s ease-out;
    }

    @keyframes settle {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .feedback { animation: none; }
    }

    .feedback.correct { background: var(--tl-feedback-ok); border-left: 4px solid #2f8f4e; }
    .feedback.incorrect { background: var(--tl-feedback-bad); border-left: 4px solid #c74e31; }

    .explanation {
      margin-top: 10px;
      font-size: 13px;
      color: var(--tl-text-muted, #255665);
    }

    .refs {
      margin-top: 8px;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--tl-text-muted, #6b7280);
    }

    .draft-badge {
      display: inline-block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: var(--tl-bar-bg);
      color: var(--tl-text, #173847);
      border-radius: 4px;
      padding: 1px 6px;
      margin-left: 8px;
    }

    button.next {
      margin-top: 16px;
      background: var(--tl-teal, #2f5e5b);
      color: var(--tl-cream, #f4efe5);
      border: none;
      border-radius: 8px;
      padding: 10px 22px;
      font-size: 14px;
      cursor: pointer;
    }

    button.next:disabled { opacity: 0.5; cursor: not-allowed; }
    button.next:focus-visible { outline: 3px solid var(--tl-navy, #173847); outline-offset: 2px; }

    img.study-figure {
      max-width: 100%;
      margin: 12px auto;
      display: block;
      background: #fff;
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 8px;
      padding: 8px;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubLang = onLangChange(() => { this.uiLang = getLang(); });
    // Keyboard (global, this is the only live question card): 1-4 or A-D
    // pick a choice, Enter advances (after answering). Form-control guard
    // keeps typing in the chooser and friends from driving the card.
    this.keyOff = onWindowKey((ke) => {
      if (inFormControl(ke)) return;
      const letterIdx = ['a', 'b', 'c', 'd'].indexOf(ke.key.toLowerCase());
      const digitIdx = ['1', '2', '3', '4'].indexOf(ke.key);
      if (letterIdx >= 0 || digitIdx >= 0) {
        const idx = letterIdx >= 0 ? letterIdx : digitIdx;
        const buttons = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('button.choice');
        if (idx >= 0 && buttons && !buttons[idx]?.disabled) {
          (buttons[idx] as HTMLButtonElement).click();
        }
      } else if (ke.key === 'Enter') {
        this.requestNext();
      }
    });
  }

  disconnectedCallback(): void {
    this.unsubLang?.();
    this.unsubLang = undefined;
    this.keyOff?.();
    this.keyOff = null;
    super.disconnectedCallback();
  }

  protected render() {
    // French UI: ISED's bilingual rows (same permutation) drive the text;
    // US questions stay canonical English. Answer math is language-invariant.
    const q = this.question ? localizeQuestion(this.question, this.uiLang) : null;
    if (!q) return nothing;
    const answered = this.pickedIndex !== null;
    const isRight = answered && this.pickedIndex === q.correctIndex;

    return html`
      <div class="section-tag">${q.section}</div>
      <div class="question-text" role="heading" aria-level="2">${q.question}</div>
      ${q.figure ? html`<img class="study-figure" src="${q.figure}" alt="${t('q.figureAlt', { id: q.id })}">` : nothing}
      <div class="choices" role="group" aria-label="${t('q.choicesAria')}">
        ${q.choices.map((choice, i) => {
          const isPicked = answered && this.pickedIndex === i;
          const revealRight = answered && !this.examMode && i === q.correctIndex;
          const cls = [
            'choice',
            isPicked && this.examMode ? 'picked' : '',
            isPicked && !this.examMode && isRight ? 'right' : isPicked && !this.examMode ? 'wrong' : '',
            revealRight ? 'right' : '',
          ].filter(Boolean).join(' ');
          return html`
            <button
              class="${cls}"
              ?disabled="${answered}"
              @click="${() => this.pick(i)}"
            >
              <span class="key">${String.fromCharCode(65 + i)}</span>
              <span>${choice}</span>
            </button>
          `;
        })}
      </div>
      ${answered && this.examMode ? html`
        <div class="feedback" role="status">${t('q.answered')}</div>
      ` : nothing}
      ${answered && !this.examMode ? html`
        <div class="feedback ${isRight ? 'correct' : 'incorrect'}" role="status">
          ${isRight ? t('q.correct') : t('q.incorrect')}
          ${q.explanation ? html`
            <div class="explanation">
              ${q.explanation}
              ${q.explanationStatus === 'draft' ? html`<span class="draft-badge">${t('q.draft')}</span>` : nothing}
            </div>
          ` : nothing}
          ${q.references.length ? html`<div class="refs">${t('q.refs', { refs: q.references.join(', ') })}</div>` : nothing}
        </div>
        ${this.advanceRequested || this.hideNext ? nothing : html`
          <button class="next" ?disabled="${this.nextDisabled}" @click="${() => this.requestNext()}">${t('q.next')}</button>
        `}
      ` : nothing}
    `;
  }

  private pick(i: number): void {
    const q = this.question;
    if (!q || this.pickedIndex !== null) return;
    this.pickedIndex = i;
    const correct = i === q.correctIndex;
    this.dispatchEvent(new CustomEvent('answered', {
      detail: { correct, choiceIndex: i },
    }));
    // in exam mode, advancing is the next question via the shell's own UI
    if (!this.examMode) return;
  }

  private requestNext(): void {
    if (this.advanceRequested || this.pickedIndex === null) return;
    this.advanceRequested = true;
    this.dispatchEvent(new CustomEvent('next'));
  }

  /** Reset for the next question (shell updates .question and calls this via updated()). */
  resetForNext(): void {
    this.pickedIndex = null;
    this.advanceRequested = false;
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    // new question → clear answered state (shell provides a NEW question object)
    if (changed.has('question') && changed.get('question') !== this.question) {
      this.pickedIndex = null;
      this.advanceRequested = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'question-card': QuestionCard;
  }
}
