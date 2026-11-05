import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/update-toast.js';

describe('update-toast', () => {
  it('offers a reload once it is visible', async () => {
    const el = await fixture<any>(html`<update-toast></update-toast>`);
    await el.updateComplete;
    el.show();
    await el.updateComplete;
    const text = el.renderRoot.textContent;
    expect(text).toContain('New version ready');
    expect(el.renderRoot.querySelector('button')?.textContent).toContain('Reload');
  });
});
