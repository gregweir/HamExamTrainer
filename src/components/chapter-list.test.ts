import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/chapter-list.js';

const sections = [
  { id: 'T1A', total: 10, studied: 4, correct: 3 },
  { id: 'T1B', total: 8, studied: 0, correct: 0 },
  { id: 'T1C', total: 12, studied: 12, correct: 11 },
];

describe('chapter-list', () => {
  it('lists sections with progress and a starter button per section', async () => {
    const el = await fixture<any>(html`<chapter-list .sections="${sections}"></chapter-list>`);
    await el.updateComplete;
    const rows = [...el.shadowRoot.querySelectorAll('button.section-row')];
    expect(rows.length).toBe(3);
    expect(el.shadowRoot.textContent).toContain('T1A');
    // T1C shows a done marker; T1B shows "not started"
    expect(el.shadowRoot.textContent).toContain('4/10');
    expect(el.shadowRoot.textContent).toContain('not started');
  });

  it('dispatches section-start with the chosen section id', async () => {
    const el = await fixture<any>(html`<chapter-list .sections="${sections}"></chapter-list>`);
    await el.updateComplete;
    let captured = null;
    el.addEventListener('section-start', (e: Event) => { captured = (e as CustomEvent).detail.section; });
    [...el.shadowRoot.querySelectorAll('button.section-row')][2]!.click();
    expect(captured).toBe('T1C');
  });
});
