import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

/**
 * One page-level capture of Chrome/Edge's beforeinstallprompt event: the
 * event fires (at most once) some time after page load, often before this
 * dialog is even connected, so it must be caught at module scope.
 * Firefox and iOS Safari never fire it — their users get the manual steps.
 */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

let deferredPrompt: InstallPromptEvent | null = null;
let listenerInstalled = false;
function captureInstallPrompt(): void {
  if (listenerInstalled) return;
  listenerInstalled = true;
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
  });
}

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * The "Install app" dialog: how to add the trainer to a home screen or
 * desktop, per platform, with a one-tap install when the browser offers one.
 */
@customElement('install-dialog')
export class InstallDialog extends LitElement {
  @state() open = false;
  @state() promptReady = false;
  private platform: Platform = 'desktop';

  static styles = css`
    :host { display: contents; }

    dialog {
      border: 1px solid var(--tl-border, rgba(23, 56, 71, 0.15));
      border-radius: 14px;
      background: var(--tl-bg, #f4efe5);
      color: var(--tl-text, #173847);
      font-family: var(--font-body, system-ui, sans-serif);
      padding: 22px;
      max-width: 430px;
      width: calc(100vw - 32px);
      box-shadow: 0 18px 50px rgba(23, 56, 71, 0.35);
    }
    dialog::backdrop { background: rgba(23, 56, 71, 0.55); }

    h2 {
      margin: 0 0 4px;
      font-size: 19px;
      color: var(--tl-heading, #173847);
    }

    .sub {
      font-size: 13px;
      line-height: 1.45;
      color: var(--tl-text-muted, #255665);
      margin: 0 0 14px;
    }

    /* the platform's own steps first and emphasised, the other two muted */
    .steps {
      border: 1px solid var(--tl-border, rgba(23, 56, 71, 0.15));
      opacity: 0.85;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .steps.own {
      border: 2px solid var(--tl-sage, #97a28a);
      opacity: 1;
      background: var(--tl-surface, #eae3d7);
    }

    .steps h3 {
      margin: 0 0 6px;
      font-size: 13.5px;
      color: var(--tl-heading, #173847);
    }

    .steps ol {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
      line-height: 1.55;
      color: var(--tl-text, #173847);
    }

    .install-now {
      margin-top: 6px;
      background: var(--tl-teal, #2f5e5b);
      color: var(--tl-cream, #f4efe5);
      border: none;
      border-radius: 8px;
      font-size: 14px;
      padding: 9px 16px;
      cursor: pointer;
    }
    .install-now:hover { filter: brightness(1.1); }
    .install-now:focus-visible { outline: 3px solid var(--tl-coral, #f58a6a); outline-offset: 2px; }

    footer {
      margin-top: 12px;
      display: flex;
      justify-content: flex-end;
    }

    .close-btn {
      background: transparent;
      color: var(--tl-text, #173847);
      border: 1px solid var(--tl-border, rgba(23, 56, 71, 0.15));
      border-radius: 8px;
      font-size: 13px;
      padding: 7px 14px;
      cursor: pointer;
    }
  `;

  private dialog: HTMLDialogElement | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    captureInstallPrompt();
    this.platform = detectPlatform();
    this.promptReady = deferredPrompt !== null;
  }

  public show(): void {
    this.promptReady = deferredPrompt !== null;
    this.open = true;
    this.dialog = this.renderRoot.querySelector('dialog');
    this.dialog?.showModal();
  }

  private close(): void {
    this.dialog?.close();
    this.open = false;
  }

  private async installNow(): Promise<void> {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    deferredPrompt = null;
    this.promptReady = false;
    this.close();
  }

  private renderSteps(kind: Platform): unknown {
    if (kind === 'ios') {
      return html`<ol>
        <li>Open this site in <strong>Safari</strong>.</li>
        <li>Tap the <strong>Share</strong> button (square with an arrow).</li>
        <li>Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
      </ol>`;
    }
    if (kind === 'android') {
      return html`<ol>
        <li>Open this site in <strong>Chrome</strong>.</li>
        <li>Tap the <strong>&#8942;</strong> menu button.</li>
        <li>Tap <strong>Install app</strong> (or <span>Add to Home screen</span>).</li>
      </ol>`;
    }
    return html`<ol>
      <li>Open this site in <strong>Chrome</strong> or <strong>Edge</strong>.</li>
      <li>Look for the install icon at the right end of the address bar.</li>
      <li>Click <strong>Install</strong>.</li>
    </ol>`;
  }

  private static readonly platformNames: Record<Platform, string> = {
    ios: 'iPhone & iPad',
    android: 'Android phone or tablet',
    desktop: 'Windows, Mac or Linux',
  };

  protected render(): unknown {
    const order: Platform[] = [this.platform, ...(['ios', 'android', 'desktop'] as Platform[]).filter(p => p !== this.platform)];
    return html`
      <dialog @cancel="${() => { this.open = false; }}">
        <h2>Install the app</h2>
        <p class="sub">
          The trainer can live on your device. Once installed, it opens
          full-screen from your home screen and works offline — every
          question bank stays on the device.
        </p>
        ${this.promptReady && this.platform !== 'ios' ? html`
          <button class="install-now" @click="${() => void this.installNow()}">Install now</button>
        ` : nothing}
        ${order.map(kind => html`
          <section class="steps ${kind === this.platform ? 'own' : ''}">
            <h3>${InstallDialog.platformNames[kind]}</h3>
            ${this.renderSteps(kind)}
          </section>
        `)}
        <footer>
          <button class="close-btn" @click="${() => this.close()}">Close</button>
        </footer>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'install-dialog': InstallDialog;
  }
}
