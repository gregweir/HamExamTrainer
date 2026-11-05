import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface SectionStat {
  id: string;
  title?: string;
  subelement?: string | null;
  total: number;
  studied: number;
  correct: number;
}

/**
 * Topic-area list for a bank: official group names, per-area progress, and
 * where to start practicing.
 *
 * Event: 'section-start' detail { section }.
 */
@customElement('chapter-list')
export class ChapterList extends LitElement {
  @property({ type: Array }) sections: SectionStat[] = [];

  static styles = css`
    :host {
      display: block;
      font-family: var(--font-body, system-ui, sans-serif);
    }

    .heading {
      font-size: 15px;
      color: var(--tl-text, #173847);
      margin: 4px 0 12px;
      font-weight: 600;
    }

    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 10px;
    }

    button.section-row {
      display: block;
      width: 100%;
      text-align: left;
      padding: 12px 16px;
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 10px;
      background: var(--tl-surface, #fff);
      color: var(--tl-text, #173847);
      font-size: 13px;
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

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--tl-text, #173847);
      margin-top: -2px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .progress-track {
      height: 4px;
      border-radius: 2px;
      background: var(--tl-choice-bg);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 2px;
      background: var(--tl-teal, #2f5e5b);
    }

    .stats {
      margin-top: 6px;
      font-size: 11px;
      color: var(--tl-text-muted, #6b7280);
    }

    .state {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--tl-choice-bg);
      color: var(--tl-text, #173847);
      flex: 0 0 auto;
    }

    .state.done { background: var(--tl-bar-bg); }
    .state.new { background: transparent; color: var(--tl-text-muted, #6b7280); }
  `;

  protected render() {
    if (!this.sections.length) return nothing;
    return html`
      <div class="heading">Study by topic</div>
      <div class="groups">
        ${this.sections.map(s => {
          const covered = s.total > 0 ? Math.min(1, s.studied / s.total) : 0;
          const state = s.studied === 0 ? 'new' : s.studied >= s.total ? 'done' : 'in progress';
          return html`
            <button class="section-row" @click="${() => this.start(s.id)}">
              <div class="row-top">
                <span class="section-id">${s.id}</span>
                <span class="state ${state.replace(' ', '-')}">${state}</span>
              </div>
              ${s.title ? html`<div class="section-title">${s.title}</div>` : nothing}
              <div class="progress-track" role="progressbar" aria-valuenow="${s.studied}" aria-valuemax="${s.total}">
                <div class="progress-fill" style="width: ${Math.round(covered * 100)}%"></div>
              </div>
              <div class="stats">
                ${s.studied === 0 ? `${s.total} questions` : `${s.studied}/${s.total} studied${s.studied ? ` · ${s.correct} first-try correct` : ''}`}
              </div>
            </button>
          `;
        })}
      </div>
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
