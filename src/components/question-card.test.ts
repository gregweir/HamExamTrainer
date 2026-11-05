import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/question-card.js';
import '../components/book-cta.js';
import type { QuestionCard } from '../components/question-card.js';
import type { ExamQuestion } from '../data/exam-banks.js';

// the card only emits `answered`; the shell records progress (storage stays out of the card)
const baseQ: ExamQuestion = {
  id: 'T1A01',
  bank: 'us-tech',
  section: 'T1A',
  question: 'Which of the following is part of the Basis and Purpose of the Amateur Radio Service?',
  choices: [
    'Providing personal radio communications for as many citizens as possible',
    'Providing communications for international contesting',
    'Advancing skills in the technical and communication phases of the radio art',
    'All these choices are correct',
  ],
  correctIndex: 3,
  references: ['[97.1]'],
  explanation: 'Section 97.1(b) says the rules aim to advance skills…',
  explanationStatus: 'reviewed',
};

describe('question-card', () => {
  it('renders question text, choices, figure, then the explanation after answering', async () => {
    el: {
      const el = await fixture<QuestionCard>(html`<question-card .question="${baseQ}"></question-card>`);
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('Basis and Purpose');
      const buttons = [...el.shadowRoot!.querySelectorAll('button.choice')];
      expect(buttons.length).toBe(4);
      expect(el.shadowRoot!.querySelector('img.study-figure')).toBeNull();
      // the explanation is feedback — it must NOT be visible before answering
      expect(el.shadowRoot!.textContent).not.toContain('97.1(b)');
      (buttons[3] as HTMLButtonElement).click();
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('97.1(b)'); // explanation after correct answer
      expect(el.shadowRoot!.querySelector('.draft-badge')).toBeNull(); // reviewed
    }
    withFigure: {
      const q = { ...baseQ, figure: 'figures/us-tech/t-1.png', explanationStatus: 'draft' as const };
      const el = await fixture<QuestionCard>(html`<question-card .question="${q}"></question-card>`);
      await el.updateComplete;
      const fig = el.shadowRoot!.querySelector('img.study-figure') as HTMLImageElement | null;
      expect(fig?.getAttribute('src')).toContain('figures/us-tech/t-1.png');
      [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.choice')][3]!.click();
      await el.updateComplete;
      expect(el.shadowRoot!.textContent.toLowerCase()).toContain('draft'); // draft watermark
    }
  });

  it('grades the pick: correct choice + progress store recorded; wrong shows truth', async () => {
    const el = await fixture<QuestionCard>(html`<question-card .question="${baseQ}"></question-card>`);
    await el.updateComplete;
    const onAnswered = vi.fn();
    el.addEventListener('answered', onAnswered);

    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.choice')];
    buttons[0]!.click(); // wrong
    await el.updateComplete;
    expect(buttons[0]!.classList.contains('wrong')).toBe(true);
    expect(buttons[3]!.classList.contains('right')).toBe(true); // revealed
    expect(onAnswered).toHaveBeenCalled();
    expect(onAnswered.mock.calls[0]![0].detail.correct).toBe(false);

    const next = el.shadowRoot!.querySelector('button.next') as HTMLButtonElement;
    expect(next).not.toBeNull(); // next appears after answering
  });

  it('keyboard: 1-4 pick, Enter advances', async () => {
    const el = await fixture<QuestionCard>(html`<question-card .question="${baseQ}"></question-card>`);
    await el.updateComplete;
    el.shadowRoot!.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true, composed: true }));
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.choice')];
    expect(buttons[3]!.classList.contains('right')).toBe(true);
    expect(el.shadowRoot!.querySelector('button.next')).not.toBeNull();
    el.shadowRoot!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('button.next')).toBeNull(); // next question requested
  });

  it('without an explanation nothing about explanations renders', async () => {
    const q = { ...baseQ, explanation: undefined, explanationStatus: 'none' as const };
    const el = await fixture<QuestionCard>(html`<question-card .question="${q}"></question-card>`);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).not.toContain('97.1(b)');
  });
});

describe('book-cta', () => {
  it('renders the RadioBook reading link + suite practice link, no gates', async () => {
    const el = await fixture<any>(html`
      <book-cta .bookHref="${'https://www.tartanleaf.com/radiobook/radiobook-getting-your-license/'}"
                .bookLabel="${'Book 3: Getting Your License'}"
                .practiceHref="${'/ladder'}"
                .practiceLabel="${'Practice in License Ladder'}"></book-cta>
    `);
    await el.updateComplete;
    const links = [...el.shadowRoot!.querySelectorAll('a')] as HTMLAnchorElement[];
    const hrefs = links.map(a => a.getAttribute('href'));
    expect(hrefs).toContain('https://www.tartanleaf.com/radiobook/radiobook-getting-your-license/');
    expect(hrefs).toContain('/ladder');
    for (const a of links) {
      if (a.host === 'www.tartanleaf.com') expect(a.getAttribute('rel')).toContain('noopener');
    }
  });
});
