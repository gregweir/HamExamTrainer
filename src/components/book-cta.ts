import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * The "read more" surface: a plain, ungated link to the matching RadioBook
 * book + (where one exists) a link to practice the topic in the game suite.
 * Promotion only — never a gate.
 */
@customElement('book-cta')
export class BookCta extends LitElement {
  @property({ type: String }) bookHref: string | null = null;
  @property({ type: String }) bookLabel = 'Read more in the RadioBook series';
  @property({ type: String }) practiceHref: string | null = null;
  @property({ type: String }) practiceLabel = 'Practice this in the game suite';

  static styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 18px;
      align-items: center;
      font-family: var(--font-body, system-ui, sans-serif);
      font-size: 13px;
      padding: 12px 18px;
      background: var(--tl-bar-bg);
      border-radius: 10px;
      color: var(--tl-text, #173847);
    }

    a {
      color: var(--tl-text-muted, #255665);
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    a:hover { color: var(--tl-teal, #2f5e5b); }
    a:focus-visible { outline: 3px solid var(--tl-navy, #173847); outline-offset: 2px; }

    .brand {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.8;
    }
  `;

  protected render() {
    return html`
      <span class="brand">Tartanleaf</span>
      ${this.bookHref ? html`<a href="${this.bookHref}" target="_blank" rel="noopener">${this.bookLabel}</a>` : nothing}
      ${this.practiceHref ? html`<a href="${this.practiceHref}">${this.practiceLabel}</a>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'book-cta': BookCta;
  }
}
