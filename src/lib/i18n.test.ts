import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getLang, setLang, onLangChange, t } from './i18n.js';
import { localizeQuestion } from '../data/exam-banks.js';
import { CA_BASIC, US_TECH, type CaExamQuestion } from '../data/exam-banks.js';

describe('i18n dictionary', () => {
  beforeEach(() => { setLang('en'); });
  afterEach(() => { setLang('en'); });

  it('interpolates in English by default', () => {
    expect(t('ready', { s: 3, n: 984 })).toContain('3 of 984');
    expect(t('tab.exam')).toBe('Exam');
  });

  it('switches to French: persisted, dispatched, translated', () => {
    let fired = 0;
    const off = onLangChange(() => { fired += 1; });
    setLang('fr');
    expect(getLang()).toBe('fr');
    expect(fired).toBe(1);
    // happy-dom / node runtimes differ on whether a real localStorage exists;
    // i18n stores the preference whenever storage IS available
    const ls = (globalThis as { localStorage?: { getItem(k: string): string | null } }).localStorage;
    if (typeof ls?.getItem === 'function') {
      expect(ls.getItem('tartanleaf.trainer.lang')).toBe('fr');
    }
    expect(t('tab.exam')).toBe('Examen');
    expect(t('tab.practice')).toBe('Pratique');
    expect(t('ready', { s: 3, n: 984 })).toContain('3 de 984');
    expect(t('review.again')).toBe('Recommencer');
    off();
    setLang('en');
  });

  it('localizes CA questions into the official ISED French text, US stays English', () => {
    const ca = CA_BASIC[0] as CaExamQuestion;
    const fr = localizeQuestion(ca, 'fr');
    expect(fr.question).toBe(ca.question_fr);
    expect(fr.choices).toEqual(ca.choices_fr);
    expect(fr.correctIndex).toBe(ca.correctIndex);
    const en = localizeQuestion(ca, 'en');
    expect(en).toBe(ca);
    const usQ = US_TECH[0]!;
    expect(localizeQuestion(usQ, 'fr')).toBe(usQ);
  });
});
