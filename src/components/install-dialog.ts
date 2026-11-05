import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getLang, onLangChange, t, type Lang } from '../lib/i18n.js';

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
  @state() private uiLang: Lang = getLang();
  private unsubLang?: () => void;
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
    this.unsubLang = onLangChange(() => { this.uiLang = getLang(); });
    captureInstallPrompt();
    this.platform = detectPlatform();
    this.promptReady = deferredPrompt !== null;
  }

  disconnectedCallback(): void {
    this.unsubLang?.();
    this.unsubLang = undefined;
    super.disconnectedCallback();
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

  private stepsName(kind: Platform): string {
    if (kind === 'ios') return t('install.ios.name');
    if (kind === 'android') return t('install.android.name');
    return t('install.desktop.name');
  }

  private renderSteps(kind: Platform): unknown {
    if (kind === 'ios') {
      return html`<ol>
        <li>${t('install.ios.s1')}</li>
        <li>${t('install.ios.s2')}</li>
        <li>${t('install.ios.s3')}</li>
      </ol>`;
    }
    if (kind === 'android') {
      return html`<ol>
        <li>${t('install.android.s1')}</li>
        <li>${t('install.android.s2')}</li>
        <li>${t('install.android.s3')}</li>
      </ol>`;
    }
    return html`<ol>
      <li>${t('install.desktop.s1')}</li>
      <li>${t('install.desktop.s2')}</li>
      <li>${t('install.desktop.s3')}</li>
    </ol>`;
  }

  protected render(): unknown {
    const order: Platform[] = [this.platform, ...(['ios', 'android', 'desktop'] as Platform[]).filter(p => p !== this.platform)];
    return html`
      <dialog @cancel="${() => { this.open = false; }}">
        <h2>${t('install.title')}</h2>
        <p class="sub">
          ${t('install.sub')}
        </p>
        ${this.promptReady && this.platform !== 'ios' ? html`
          <button class="install-now" @click="${() => void this.installNow()}">${t('install.now')}</button>
        ` : nothing}
        ${order.map(kind => html`
          <section class="steps ${kind === this.platform ? 'own' : ''}">
            <h3>${this.stepsName(kind)}</h3>
            ${this.renderSteps(kind)}
          </section>
        `)}
        <footer>
          <button class="close-btn" @click="${() => this.close()}">${t('install.close')}</button>
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
