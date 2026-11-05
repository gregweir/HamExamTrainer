import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/exam-shell.js';
import type { ExamShell } from '../components/exam-shell.js';

describe('exam-shell', () => {
  it('renders the brand bar (logo + full name) and the bank chooser with v1 banks', async () => {
    const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
    await el.updateComplete;
    const text = el.shadowRoot!.textContent!;
    expect(text).toContain('Tartanleaf Ham Exam Trainer');
    const options = [...el.shadowRoot!.querySelectorAll('select.bank-chooser option')] as HTMLOptionElement[];
    expect(options.map(o => o.value)).toEqual(expect.arrayContaining(['us-tech', 'ca-basic']));
    expect(el.shadowRoot!.querySelector('img.brand-logo')).not.toBeNull();
  });

  it('Practice tab lists the bank sections (chapter list); book CTA links present', async () => {
    const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('chapter-list')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('book-cta')).not.toBeNull();
  });

  it('starting a section shows the question card with that bank+section’s first question', async () => {
    const el = await fixture<ExamShell>(html`<exam-shell></exam-shell>`);
    await el.updateComplete;
    const cl = el.shadowRoot!.querySelector('chapter-list')!;
    cl.dispatchEvent(new CustomEvent('section-start', { detail: { section: 'T1A' } }));
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector('question-card')!;
    expect((card as any).question?.section).toBe('T1A');
    // answering advances and records progress
    await new Promise(r => setTimeout(r, 0));
    const choices = [...card.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.choice')];
    choices[0]!.click();
    await card.updateComplete;
    const next = card.shadowRoot!.querySelector('button.next') as HTMLButtonElement;
    next.click();
    await el.updateComplete;
    expect(((card as any).question as { id: string }).id).not.toBe('T1A01');
  });
});
