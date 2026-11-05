import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/install-dialog.js';

describe('install-dialog', () => {
  it('opens as a modal with steps for all three platforms', async () => {
    const el = await fixture<any>(html`<install-dialog></install-dialog>`);
    await el.updateComplete;
    el.show();
    await el.updateComplete;
    const dialog = el.renderRoot.querySelector('dialog');
    expect(dialog?.open).toBe(true);
    const text = el.renderRoot.textContent ?? '';
    expect(text).toContain('Install the app');
    expect(text).toContain('iPhone & iPad');
    expect(text).toContain('Android phone or tablet');
    expect(text).toContain('Windows, Mac or Linux');
    expect(text).toContain('Add to Home Screen');
    expect(text).toContain('Install app');
    expect(text).toContain('address bar');
  });

  it('closes via the Close button and cancel', async () => {
    const el = await fixture<any>(html`<install-dialog></install-dialog>`);
    await el.updateComplete;
    el.show();
    await el.updateComplete;
    const dialog = el.renderRoot.querySelector('dialog');
    dialog!.querySelector('.close-btn')!.click();
    await el.updateComplete;
    expect(dialog!.open).toBe(false);
    expect(el.open).toBe(false);
  });
});
