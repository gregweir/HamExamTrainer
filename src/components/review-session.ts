import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ExamQuestion } from '../data/exam-banks.js';
import type { ProgressStore, ProgressRecord } from '../lib/progress.js';
import { nextSchedule } from '../lib/sm2.js';
import { getLang, onLangChange, t, type Lang } from '../lib/i18n.js';
import { inFormControl, onWindowKey } from '../lib/keys.js';
import './question-card.js';

/**
 * Spaced review: works the due queue (from the ProgressStore), grades each
 * answer on the SM-2 quality scale, then shows the session summary.
 *
 * Properties:
 *  - store: the ProgressStore (or a compatible test stub)
 *  - bank, now (0 = real clock; a fixed value makes tests deterministic)
 *  - resolveQuestion: identity → question (bank data knows the question; the
 *    store deliberately does not — falls back to a store helper if provided)
 *
 * Grade buttons follow the SM-2 convention: Again(1) Hard(3) Good(4) Easy(5).
 */
@customElement('review-session')
export class ReviewSession extends LitElement {
  @property({ type: Object }) store: ProgressStore | null = null;
  @property({ type: String }) bank = '';
  @property({ type: Number }) now = 0;
  @property({ type: Object }) resolveQuestion: ((identity: string) => Promise<ExamQuestion | null>) | null = null;

  @state() queue: { identity: string; record: ProgressRecord }[] = [];
  @state() position = 0;
  @state() current: ExamQuestion | null = null;
  @state() answeredCorrectly: (boolean | null)[] = [];
  @state() loaded = false;

  @state() private uiLang: Lang = getLang();
  private keyOff: (() => void) | null = null;
  private unsubLang?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubLang = onLangChange(() => { this.uiLang = getLang(); });
    // grade keys: 1-4 map onto Again/Hard/Good/Easy (SM-2 qualities 1/3/4/5)
    // once the card is answered; before that the digits answer the question
    this.keyOff = onWindowKey((ke) => {
      if (inFormControl(ke)) return;
      const qualities = [1, 3, 4, 5];
      const idx = ['1', '2', '3', '4'].indexOf(ke.key);
      if (idx < 0) return;
      const item = this.queue[this.position];
      if (!item || this.answeredCorrectly[this.position] === null) return;
      void this.grade(qualities[idx]!);
      ke.preventDefault();
    });
  }

  disconnectedCallback(): void {
    this.unsubLang?.();
    this.unsubLang = undefined;
    this.keyOff?.();
    this.keyOff = null;
    super.disconnectedCallback();
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--font-body, system-ui, sans-serif);
      color: var(--tl-text, #173847);
    }

    .heading { font-size: 15px; font-weight: 600; margin: 4px 0 10px; }

    .grades {
      display: flex;
      gap: 10px;
      margin-top: 14px;
      flex-wrap: wrap;
    }

    button.grade {
      border: 1px solid var(--tl-border, #e5e0d5);
      background: var(--tl-choice-bg);
      color: var(--tl-text, #173847);
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
    }

    button.grade:hover { border-color: var(--tl-sage, #97a28a); }
    button.grade:focus-visible { outline: 3px solid var(--tl-teal, #2f5e5b); outline-offset: 2px; }

    button.grade kbd {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      opacity: 0.6;
      margin-left: 2px;
    }

    button.grade[data-quality='1'] { background: #f9ece8; border-color: #d8a79a; }
    button.grade[data-quality='4'] { background: #eaf6ee; border-color: #a7c9b1; }

    .empty {
      text-align: center;
      padding: 28px 14px;
      color: var(--tl-text-muted, #255665);
      background: var(--tl-surface, #fff);
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 12px;
      font-size: 15px;
    }

    .summary {
      text-align: center;
      padding: 30px 14px;
      background: var(--tl-surface, #fff);
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 12px;
      font-size: 15px;
    }
  `;

  updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    // Load once the bound store AND a bank are both present (pre-upgrade /
    // fixture timings can deliver them in separate cycles).
    if (this.store && this.bank && !this.loaded) {
      void this.load();
    } else if (this.store && this.bank && (changed.has('bank') || changed.has('now'))) {
      void this.load();
    }
  }

  private effectiveNow(): number {
    return this.now > 0 ? this.now : Date.now();
  }

  async load(): Promise<void> {
    const due = (await this.store?.dueQueue(this.bank, 20, this.effectiveNow())) ?? [];
    this.queue = due.map(record => ({ identity: record.identity, record }));
    this.answeredCorrectly = new Array(this.queue.length).fill(null);
    this.loaded = true;
    this.position = 0;
    await this.loadCurrent();
  }

  private async loadCurrent(): Promise<void> {
    const item = this.queue[this.position];
    if (!item) {
      this.current = null;
      return;
    }
    const resolver =
      this.resolveQuestion ??
      ((identity: string) =>
        (this.store as unknown as { getQuestionByIdentity?: (i: string) => Promise<ExamQuestion | null> })
          ?.getQuestionByIdentity?.(identity) ?? Promise.resolve(null));
    this.current = await resolver(item.identity);
  }

  protected render() {
    if (this.loaded && this.queue.length === 0) {
      return html`<div class="empty" role="status">${t('review.empty')}</div>`;
    }
    if (this.position >= this.queue.length) {
      if (!this.loaded) return nothing;
      return this.renderEnd();
    }
    const q = this.current;
    const answered = this.answeredCorrectly[this.position] !== null;
    return html`
      <div class="heading">${t('review.heading', { i: this.position + 1, n: this.queue.length })}</div>
      ${q ? html`
        <question-card
          .question="${q}"
          .hideNext="${true}"
          @answered="${(e: CustomEvent) => {
            // immutable: Lit does not observe indexed array writes
            const next = [...this.answeredCorrectly];
            next[this.position] = e.detail.correct as boolean;
            this.answeredCorrectly = next;
          }}"
        ></question-card>
        ${answered ? html`
          <div class="grades" role="group" aria-label="${t('review.gradesAria')}">
            <button class="grade" data-quality="1" title="Key 1" @click="${() => void this.grade(1)}">${t('review.again')} <kbd>1</kbd></button>
            <button class="grade" data-quality="3" title="Key 2" @click="${() => void this.grade(3)}">${t('review.hard')} <kbd>2</kbd></button>
            <button class="grade" data-quality="4" title="Key 3" @click="${() => void this.grade(4)}">${t('review.good')} <kbd>3</kbd></button>
            <button class="grade" data-quality="5" title="Key 4" @click="${() => void this.grade(5)}">${t('review.easy')} <kbd>4</kbd></button>
          </div>
        ` : nothing}
      ` : html`<div class="empty">${t('review.gone')}</div>`}
    `;
  }

  private renderEnd() {
    const good = this.answeredCorrectly.filter(c => c === true).length;
    const missed = this.answeredCorrectly.filter(c => c === false).length;
    const skipped = this.queue.length - this.answeredCorrectly.filter(c => c !== null).length;
    return html`
      <div class="summary" role="status">
        ${t('review.done', { g: good, m: missed, skip: skipped ? t('review.skippedTail', { n: skipped }) : '' })}
      </div>
    `;
  }

  private async grade(quality: number): Promise<void> {
    const item = this.queue[this.position];
    if (!item || this.answeredCorrectly[this.position] === null) return;
    const now = this.effectiveNow();
    const sched = nextSchedule(item.record, quality, now);
    await this.store?.recordAnswer(item.identity, this.answeredCorrectly[this.position] === true, now, sched);
    this.position += 1;
    await this.loadCurrent();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'review-session': ReviewSession;
  }
}
