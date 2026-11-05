import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/review-session.js';
import type { ReviewSession } from '../components/review-session.js';
import { contentIdentity } from '../lib/ident.js';
import type { ProgressStore } from '../lib/progress.js';

const DIPOLE_Q = 'Which of the following increases the resonant frequency of a dipole antenna?';
const seedRecord = (text: string, ease: number, intervalDays: number, dueAt: number) => ({
  identity: contentIdentity('us-tech', 'T1A', text),
  ease, intervalDays, dueAt, attempts: 1, correctCount: 1, wrongCount: 0, lastStudiedAt: 0,
});

/** A stub store the component treats as ProgressStore (duck-typed). */
class StubStore {
  records: Record<string, unknown> = {};
  async reset() {}
  async getRecord(k: string) { return (this.records[k] ?? null) as never; }
  async recordAnswer(k: string, correct: boolean, at: number, sched?: unknown) {
    this.records[k] = { identity: k, ease: (sched as any)?.ease ?? 2.5, intervalDays: (sched as any)?.intervalDays, dueAt: (sched as any)?.dueAt, attempts: 1, correctCount: correct ? 1 : 0, wrongCount: correct ? 0 : 1, lastStudiedAt: at };
  }
  async dueQueue(bank: string, limit: number, now: number) {
    return Object.values(this.records).filter((r: any) => r.identity.startsWith(bank + ':') && r.dueAt <= now).sort((a: any, b: any) => a.dueAt - b.dueAt).slice(0, limit) as never;
  }
  async getQuestionByIdentity(identity: string) {
    if (contentIdentity('us-tech', 'T1A', DIPOLE_Q) === identity) {
      const { US_TECH } = await import('../data/exam-banks.js');
      return US_TECH.find(q => q.question === DIPOLE_Q) ?? null;
    }
    return null;
  }
  async saveExamSession(_s: unknown) {}
  async loadExamSession(_b: string) { return null; }
  async clearExamSession(_b: string) {}
  async exportAll() { return { version: 1 as const, records: {}, examSessions: [], settings: {} }; }
  async importAll(_b: unknown) {}
  async getSetting<T>(_k: string, f: T): Promise<T> { return f; }
  async setSetting(_k: string, _v: unknown) {}
}

describe('review-session', () => {
  it('grades the card (1-5) and updates the schedule; shows a summary afterwards', async () => {
    const store = new StubStore();
    const DIP_IDENTITY = contentIdentity('us-tech', 'T1A', DIPOLE_Q);
    store.records[DIP_IDENTITY] = seedRecord(DIPOLE_Q, 2.5, 1, 1000);
    const el = await fixture<any>(html`<review-session></review-session>`);
    el.store = store;
    el.bank = 'us-tech';
    el.now = 10_000;
    await el.updateComplete;
    // wait until the due question actually renders (the resolver does a
    // dynamic module import on its first call)
    for (let i = 0; i < 20 && !el.shadowRoot.querySelector('question-card'); i++) {
      await new Promise(r => setTimeout(r, 25));
      await el.updateComplete;
    }
    const card = el.shadowRoot.querySelector('question-card');
    expect(card, 'due question rendered').not.toBeNull();
    // answer + grade "good" (4)
    const choices = [...card!.shadowRoot.querySelectorAll('button.choice')];
    choices[2]!.click();
    await card!.updateComplete;
    const gradeBtn = [...el.shadowRoot.querySelectorAll('button.grade')].map((b: HTMLButtonElement) => b)[0];
    expect([...el.shadowRoot.querySelectorAll('button.grade')].length).toBeGreaterThanOrEqual(3);
    // click the "good" button (data-quality=4)
    const good = el.shadowRoot.querySelector('button.grade[data-quality="4"]') as HTMLButtonElement;
    good!.click();
    await el.updateComplete;
    const updated = store.records[DIP_IDENTITY] as any;
    expect(updated.intervalDays).toBe(6);
    expect(updated.lastStudiedAt).toBe(10_000);
  });

  it('keyboard: 1-4 grade the answered card (Again/Hard/Good/Easy)', async () => {
    const store = new StubStore();
    const DIP_IDENTITY = contentIdentity('us-tech', 'T1A', DIPOLE_Q);
    store.records[DIP_IDENTITY] = seedRecord(DIPOLE_Q, 2.5, 1, 1000);
    const el = await fixture<any>(html`<review-session></review-session>`);
    el.store = store;
    el.bank = 'us-tech';
    el.now = 10_000;
    await el.updateComplete;
    for (let i = 0; i < 20 && !el.shadowRoot.querySelector('question-card'); i++) {
      await new Promise(r => setTimeout(r, 25));
      await el.updateComplete;
    }
    const card = el.shadowRoot.querySelector('question-card');
    // a wrong answer first (any answer enables the grade row)
    [...card!.shadowRoot.querySelectorAll('button.choice')][1]!.click();
    await card!.updateComplete;
    await el.updateComplete;
    // key 1 = Again (SM-2 quality 1): a lapse, so the interval resets to 1 day
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    await el.updateComplete;
    expect((store.records[DIP_IDENTITY] as any).intervalDays).toBe(1);
    expect((store.records[DIP_IDENTITY] as any).ease).toBeLessThan(2.5);
  });

  it('shows the empty state when nothing is due', async () => {
    const store = new StubStore();
    const el = await fixture<any>(html`<review-session></review-session>`);
    el.store = store;
    el.bank = 'us-tech';
    el.now = 10_000;
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));
    await el.updateComplete;
    expect(el.shadowRoot.textContent.toLowerCase()).toContain('nothing due');
  });
});
