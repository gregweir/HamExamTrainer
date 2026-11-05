import { describe, it, expect } from 'vitest';
import {
  normalizeQuestionText,
  contentIdentity,
  contentIdentityFromQuestion,
} from './ident.js';
import type { ExamQuestion } from '../data/exam-banks.js';
import { CA_BASIC, US_TECH } from '../data/exam-banks.js';
import usGeneralData from '../data/banks/us-general.json';
import usExtraData from '../data/banks/us-extra.json';
import caAdvancedData from '../data/banks/ca-advanced.json';

/**
 * All five banks, EN view. The parked banks are read straight from their JSON
 * (they are deliberately NOT statically imported by exam-banks.ts — bundle
 * hygiene) — the identity layer must still treat their rows like any other.
 */
const ALL_BANKS: ExamQuestion[] = [
  ...US_TECH,
  ...(CA_BASIC as unknown as ExamQuestion[]),
  ...(usGeneralData as unknown as ExamQuestion[]),
  ...(usExtraData as unknown as ExamQuestion[]),
  ...(caAdvancedData as unknown as ExamQuestion[]),
];

describe('normalizeQuestionText', () => {
  it('collapses whitespace and normalizes quotes case-insensitively', () => {
    expect(normalizeQuestionText('What’s  the   current?')).toBe(
      "what's the current"
    );
    // non-breaking spaces must not survive (they appear when banks are copy-pasted)
    expect(normalizeQuestionText('Same text')).toBe('same text');
  });

  it('is insensitive to trailing punctuation-only differences', () => {
    // Pool re-bases routinely flip punctuation; identical substance must hash equal.
    expect(normalizeQuestionText('What is a dipole?')).toBe(
      normalizeQuestionText('What is a dipole.')
    );
  });

  it('keeps distinct questions distinct (not over-aggressive)', () => {
    expect(normalizeQuestionText('What is a loop antenna?')).not.toBe(
      normalizeQuestionText('What is a dipole antenna?')
    );
  });
});

describe('contentIdentity', () => {
  it('is stable across pool versions: same bank+section+normalised text = same key', () => {
    const a = contentIdentity('us-tech', 'T1A', 'Which of the following is part of the Basis and Purpose?');
    const b = contentIdentity('us-tech', 'T1A', 'Which   of the \n following is part of the Basis and Purpose?! ');
    expect(a).toBe(b);
  });

  it('differs across banks and sections', () => {
    const a = contentIdentity('us-tech', 'T1A', 's');
    expect(a).not.toBe(contentIdentity('ca-basic', 'T1A', 's'));
    expect(a).not.toBe(contentIdentity('us-tech', 'T1B', 's'));
  });

  it('maps every real bank question to a content identity, 1:1 within EACH bank (true duplicates excepted)', () => {
    // ISED legitimately ships multiple DISTINCT questions sharing one question
    // text (different choices) — bank+section+text alone collides on those
    // rows, silently merging unrelated progress records. The identity must
    // fold the CHOICES in and stay 1:1 bank-wide over ALL five banks.
    //
    // The one permitted exception: rows that are TRUE content duplicates —
    // same normalized stem, same choice SET, same correct answer text (they
    // differ only in the presented order of the choices). Those are the same
    // question in substance and MUST share progress; today ca-basic carries
    // exactly one such pair (B-001-019-004 / B-001-019-006, both answer
    // "100%"), and no other collision may exist in any bank.
    const trueDupeKey = (q: ExamQuestion): string => {
      const sorted = q.choices.map(normalizeQuestionText).sort().join('\u001f');
      const correct = normalizeQuestionText(q.choices[q.correctIndex] ?? '');
      return `${normalizeQuestionText(q.question)}\u001e${sorted}\u001e${correct}`;
    };
    const byBank = new Map<string, ExamQuestion[]>();
    for (const q of ALL_BANKS) {
      const list = byBank.get(q.bank) ?? [];
      list.push(q);
      byBank.set(q.bank, list);
    }
    expect([...byBank.keys()].sort()).toEqual(
      ['ca-advanced', 'ca-basic', 'us-extra', 'us-general', 'us-tech']
    );

    const dupePairSummary: string[] = [];
    for (const [bank, questions] of byBank) {
      const collisions = new Map<string, number>();
      for (const q of questions) {
        const id = contentIdentityFromQuestion(q);
        collisions.set(id, (collisions.get(id) ?? 0) + 1);
      }
      for (const [id, count] of collisions) {
        if (count === 1) continue;
        const group = questions.filter(q => contentIdentityFromQuestion(q) === id);
        // every colliding row must be the SAME question in substance (only
        // the presented choice order differs) — otherwise the key failed.
        const keys = new Set(group.map(trueDupeKey));
        expect(
          keys.size,
          `${bank}: identity ${id} merged ${count} DISTINCT questions`
        ).toBe(1);
        dupePairSummary.push(`${bank}: ${group.map(q => q.id).join('+')}`);
      }
    }
    // today's only true duplicates — the anchor so a re-base that resolves or
    // multiplies these rows goes through an identity review, not silently.
    expect(dupePairSummary).toEqual(['ca-basic: B-001-019-004+B-001-019-006']);
  });

  it('collides on the same stem TODAY when choices are ignored (regression anchor)', () => {
    // ca-basic B-001-016-009/-010/-011 share one question text with three
    // different choice sets — the OLD key (bank+section+text) merges them.
    const stem = ALL_BANKS.find(
      (q) => q.bank === 'ca-basic' && q.id === 'B-001-016-009'
    );
    const twin = ALL_BANKS.find(
      (q) => q.bank === 'ca-basic' && q.id === 'B-001-016-010'
    );
    expect(stem && twin).toBeTruthy();
    expect(stem!.question).toBe(twin!.question);
    expect(stem!.choices).not.toEqual(twin!.choices);
  });

  it('is identity-stable across a choice PERMUTATION (correctIndex not in the hash)', () => {
    const q = ALL_BANKS[0]!;
    const shuffled = {
      ...q,
      choices: [...q.choices].reverse(),
      correctIndex: q.correctIndex,
    };
    expect(contentIdentityFromQuestion(q)).toBe(
      contentIdentityFromQuestion(shuffled)
    );
    // but a different choice SET is a different question
    expect(contentIdentityFromQuestion(q)).not.toBe(
      contentIdentityFromQuestion({ ...q, choices: [...q.choices.slice(1), q.choices[0]! + ' (revised)'] })
    );
  });

  it('choice-only input: explicit array form matches the question form', () => {
    const q = ALL_BANKS[0]!;
    expect(
      contentIdentity(q.bank, q.section, q.question, q.choices)
    ).toBe(contentIdentityFromQuestion(q));
    // and the legacy 3-arg call compiles + differs from the choices-aware key
    // ONLY when the caller had same-stem twins (legacy aliases for older data
    // keep working: they just never fold choices in).
    expect(contentIdentity(q.bank, q.section, q.question)).toBeDefined();
  });
});
