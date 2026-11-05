import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/chapter-list.js';

const blocks = [
  {
    id: 'B-001',
    title: 'Regulations and operating requirements',
    subsections: [
      { id: 'B-001-001', total: 8, studied: 3, correct: 2 },
      { id: 'B-001-002', total: 8, studied: 0, correct: 0 },
    ],
  },
  {
    id: 'B-002',
    title: 'Operating procedures and Q signals',
    subsections: [
      { id: 'B-002-001', total: 9, studied: 9, correct: 8 },
    ],
  },
];

describe('chapter-list', () => {
  it('renders subject-block headers with titles and their subsection rows', async () => {
    const el = await fixture<any>(html`<chapter-list .blocks="${blocks}"></chapter-list>`);
    await el.updateComplete;
    const headers = [...el.shadowRoot.querySelectorAll('.block-title')];
    expect(headers.length).toBe(2);
    expect(headers[0]!.textContent).toContain('Regulations and operating requirements');
    const rows = [...el.shadowRoot.querySelectorAll('button.section-row')];
    expect(rows.length).toBe(3);
    expect(el.shadowRoot.textContent).toContain('B-001-001');
    expect(el.shadowRoot.textContent).toContain('3/8 studied');
    expect(el.shadowRoot.textContent.toLowerCase()).toContain('in progress');
  });

  it('dispatches section-start with the chosen subsection id', async () => {
    const el = await fixture<any>(html`<chapter-list .blocks="${blocks}"></chapter-list>`);
    await el.updateComplete;
    let captured: string | null = null;
    el.addEventListener('section-start', (e: Event) => { captured = (e as CustomEvent).detail.section; });
    const rows = [...el.shadowRoot.querySelectorAll('button.section-row')];
    rows[2]!.click(); // B-002-001
    expect(captured).toBe('B-002-001');
  });

  it('renders the bare group id with no title when a block is unnamed (US banks already titled)', async () => {
    const unnamed = [{ id: 'T5A', title: undefined, subsections: [{ id: 'T5A-01', total: 4, studied: 0, correct: 0 }] }];
    const el = await fixture<any>(html`<chapter-list .blocks="${unnamed}"></chapter-list>`);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector('.block-title')!.textContent!.trim()).toBe('T5A');
  });
});
