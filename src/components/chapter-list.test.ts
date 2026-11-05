import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/chapter-list.js';

const sections = [
  { id: 'T1A', title: 'Purpose and permissible use of the Amateur Radio Service', total: 10, studied: 4, correct: 3 },
  { id: 'T1B', total: 8, studied: 0, correct: 0 },
  { id: 'T1C', total: 12, studied: 12, correct: 11 },
];

describe('chapter-list', () => {
  it('lists sections: official names, progress bars, per-section state', async () => {
    const el = await fixture<any>(html`<chapter-list .sections="${sections}"></chapter-list>`);
    await el.updateComplete;
    const rows = [...el.shadowRoot.querySelectorAll('button.section-row')];
    expect(rows.length).toBe(3);
    expect(el.shadowRoot.textContent).toContain('T1A');
    expect(el.shadowRoot.textContent).toContain('Purpose and permissible use');
    expect(el.shadowRoot.textContent).toContain('4/10');
    expect(el.shadowRoot.textContent.toLowerCase()).toContain('in progress');
    expect(el.shadowRoot.textContent.toLowerCase()).toContain('done');
    expect(el.shadowRoot.querySelector('.progress-track')).not.toBeNull();
  });

  it('renders no title row when the bank has no official group names', async () => {
    const untitled = sections.map(s => ({ ...s, title: undefined }));
    const el = await fixture<any>(html`<chapter-list .sections="${untitled}"></chapter-list>`);
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll('.section-title').length).toBe(0);
  });

  it('dispatches section-start with the chosen section id', async () => {
    const el = await fixture<any>(html`<chapter-list .sections="${sections}"></chapter-list>`);
    await el.updateComplete;
    let captured: string | null = null;
    el.addEventListener('section-start', (e: Event) => { captured = (e as CustomEvent).detail.section; });
    [...el.shadowRoot.querySelectorAll('button.section-row')][2]!.click();
    expect(captured).toBe('T1C');
  });
});
