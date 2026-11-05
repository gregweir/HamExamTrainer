import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { watchForServiceWorkerUpdate } from '../lib/update-banner.js';

/**
 * One-line toast: "New version ready" + Reload, shown when a freshly
 * deployed service worker has taken over an already-running app.
 */
@customElement('update-toast')
export class UpdateToast extends LitElement {
  @state() visible = false;

  static styles = css`
    :host {
      display: block;
      position: fixed;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      z-index: 999;
    }
    :host([hidden]) { display: none; }

    .toast {
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--tl-chrome-bg, #255665);
      color: var(--tl-cream, #f4efe5);
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 13px;
      box-shadow: 0 8px 26px rgba(23, 56, 71, 0.4);
      font-family: var(--font-body, system-ui, sans-serif);
    }

    button {
      background: var(--tl-cream, #f4efe5);
      color: var(--tl-navy, #173847);
      border: none;
      border-radius: 7px;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 14px;
      cursor: pointer;
      font-family: inherit;
    }
    button:hover { filter: brightness(0.96); }
    button:focus-visible { outline: 3px solid var(--tl-coral, #f58a6a); outline-offset: 2px; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    watchForServiceWorkerUpdate(() => { this.visible = true; });
  }

  /** Test/external hook: surface the toast (the watcher calls its callback). */
  public show(): void {
    this.visible = true;
  }

  private reload(): void {
    window.location.reload();
  }

  protected render(): unknown {
    if (!this.visible) {
      return nothing;
    }
    return html`
      <div class="toast" role="status">
        <span>New version ready — a quick reload picks it up.</span>
        <button @click="${() => this.reload()}">Reload</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'update-toast': UpdateToast;
  }
}
