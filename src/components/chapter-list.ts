import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface SectionStat {
  id: string;
  total: number;
  studied: number;
  correct: number;
}

/**
 * Topic-area (section) list for a bank: what each area's progress looks like
 * and where to start practicing.
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
      color: var(--tl-navy, #173847);
      margin: 4px 0 10px;
      font-weight: 600;
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    button.section-row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      text-align: left;
      padding: 12px 16px;
      border: 1px solid var(--tl-border, #e5e0d5);
      border-radius: 10px;
      background: var(--tl-surface, #fff);
      color: var(--tl-text, #173847);
      font-size: 14px;
      cursor: pointer;
    }

    button.section-row:hover { border-color: var(--tl-sage, #97a28a); }
    button.section-row:focus-visible { outline: 3px solid var(--tl-teal, #2f5e5b); outline-offset: 2px; }

    .section-id {
      font-family: var(--font-mono, monospace);
      font-size: 13px;
      color: var(--tl-slate, #255665);
      flex: 0 0 90px;
    }

    .stats {
      flex: 1;
      font-size: 12px;
      color: var(--tl-text-muted, #6b7280);
    }

    .stats strong { color: var(--tl-navy, #173847); }

    .state {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--tl-stone, #eae3d7);
      color: var(--tl-navy, #173847);
    }
    .state.done { background: var(--tl-light-sage, #c8d0c0); }
    .state.new { background: var(--tl-cream, #f4efe5); color: var(--tl-slate, #255665); }
  `;

  protected render() {
    if (!this.sections.length) return nothing;
    return html`
      <div class="heading">Study by topic</div>
      <div class="rows">
        ${this.sections.map(s => {
          const state = s.studied === 0 ? 'new' : s.studied >= s.total ? 'done' : 'in progress';
          return html`
            <button class="section-row" @click="${() => this.start(s.id)}">
              <span class="section-id">${s.id}</span>
              <span class="stats">
                ${s.studied === 0 ? 'not started' : html`<strong>${s.studied}/${s.total}</strong> studied`}
                ${s.studied ? ` · ${s.correct} first-try correct` : ''}
              </span>
              <span class="state ${state.replace(' ', '-')}">${state}</span>
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
