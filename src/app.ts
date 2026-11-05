import { LitElement, css, html } from 'lit';
import logoUrl from './assets/logo.jpg';

/**
 * Placeholder start screen. The full study UI arrives in later tasks.
 */
export class TartanleafApp extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-color: var(--tl-bg, #F4EFE5);
      color: var(--tl-text, #173847);
      font-family: system-ui, -apple-system, sans-serif;
      gap: 12px;
    }
    .logo {
      width: 96px;
      height: 96px;
      border-radius: 16px;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--tl-accent, #2F5E5B);
    }
    p {
      margin: 0;
      color: var(--tl-text-muted, #255665);
    }
  `;

  render() {
    return html`
      <img class="logo" src=${logoUrl} alt="Tartanleaf" />
      <h1>Tartanleaf Ham Exam Trainer</h1>
      <p>US &amp; Canada exam study — coming together.</p>
    `;
  }
}

customElements.define('tartanleaf-app', TartanleafApp);

declare global {
  interface HTMLElementTagNameMap {
    'tartanleaf-app': TartanleafApp;
  }
}
