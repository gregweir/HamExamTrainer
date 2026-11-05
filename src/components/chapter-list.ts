import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getLang, onLangChange, t, type Lang } from '../lib/i18n.js';

export interface SubsectionStat {
  id: string; // e.g. B-001-002 (the ISED exam subsection)
  title?: string;
  total: number;
  studied: number;
  correct: number;
}

export interface SubjectBlock {
  id: string; // e.g. B-001 (ISED) or T1A (NCVEC group)
  title?: string;
  subsections: SubsectionStat[];
}

/**
 * Subject blocks with their subsection rows: what a bank's topics look like
 * (ISED = 8/7 subject blocks; NCVEC = one-syllabus-name groups).
 *
 * Event: 'section-start' detail { section } — section is the subsection id.
 */
@customElement('chapter-list')
export class ChapterList extends LitElement {
  @property({ type: Array }) blocks: SubjectBlock[] = [];
  @state() private uiLang: Lang = getLang();

  private unsubLang?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubLang = onLangChange(() => { this.uiLang = getLang(); });
  }

  disconnectedCallback(): void {
    this.unsubLang?.();
    this.unsubLang = undefined;
    super.disconnectedCallback();
  }

  static styles = css`
    :host {
      display: block;
      font-family: var(--font-body, system-ui, sans-serif);
    }

    .block-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--tl-heading, #173847);
      margin: 18px 0 8px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .block-code {
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      font-weight: 600;
      color: var(--tl-text-muted, #255665);
      margin-right: 8px;
    }

    .rows {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 8px;
    }

    button.section-row {
      display: block;
      width: 100%;
      text-align: left;
      padding: 10px 14px;
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 10px;
      background: var(--tl-surface, #fff);
      color: var(--tl-text, #173847);
      font-size: 12px;
      cursor: pointer;
      transition: border-color 0.15s;
    }

    button.section-row:hover { border-color: var(--tl-sage, #97a28a); }
    button.section-row:focus-visible { outline: 3px solid var(--tl-teal, #2f5e5b); outline-offset: 2px; }

    .row-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .section-id {
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: var(--tl-text-muted, #255665);
    }

    .s-title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.25;
      color: var(--tl-text, #173847);
      margin: 0 0 8px;
    }

    .progress-track {
      height: 4px;
      border-radius: 2px;
      background: var(--tl-stone, #eae3d7);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 2px;
      background: var(--tl-teal, #2f5e5b);
    }

    .stats {
      margin-top: 5px;
      font-size: 11px;
      color: var(--tl-text-muted, #6b7280);
      font-family: var(--font-mono, monospace);
    }

    .state {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--tl-stone, #eae3d7);
      color: var(--tl-navy, #173847);
      flex: 0 0 auto;
    }

    .state.done { background: var(--tl-light-sage, #c8d0c0); }
    .state.new { background: transparent; color: var(--tl-text-muted, #6b7280); }
  `;

  protected render() {
    if (!this.blocks.length) return nothing;
    return html`
      ${this.blocks.map(b => html`
        <div class="block-title"
          role="heading" aria-level="3"
        >${b.title ? html`<span class="block-code">${b.id}</span>${b.title}` : b.id}</div>
        <div class="rows">
          ${b.subsections.map(s => {
            const covered = s.total > 0 ? Math.min(1, s.studied / s.total) : 0;
            const state = s.studied === 0 ? t('list.new') : s.studied >= s.total ? t('list.done') : t('list.inProgress');
            const stateCls = s.studied === 0 ? 'new' : s.studied >= s.total ? 'done' : 'in-progress';
            return html`
              <button class="section-row" @click="${() => this.start(s.id)}">
                <div class="row-top">
                  <span class="section-id">${s.id}</span>
                  <span class="state ${stateCls}">${state}</span>
                </div>
                ${s.title ? html`<div class="s-title">${s.title}</div>` : nothing}
                <div class="progress-track" role="progressbar" aria-valuenow="${s.studied}" aria-valuemax="${s.total}">
                  <div class="progress-fill" style="width: ${Math.round(covered * 100)}%"></div>
                </div>
                <div class="stats">
                  ${s.studied === 0 ? t('list.nQuestions', { n: s.total }) : t('list.nStudied', { s: s.studied, n: s.total })}
                </div>
              </button>
            `;
          })}
        </div>
      `)}
    `;
  }

  private start(section: string): void {
    this.dispatchEvent(new CustomEvent('section-start', { detail: { section } }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chapter-list': ChapterList;
  }
}
