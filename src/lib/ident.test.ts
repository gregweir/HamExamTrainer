import { describe, it, expect } from 'vitest';
import {
  normalizeQuestionText,
  contentIdentity,
  contentIdentityFromQuestion,
} from './ident.js';
import type { ExamQuestion } from '../data/exam-banks.js';
import { US_TECH } from '../data/exam-banks.js';

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

  it('maps every real bank question to a content identity, 1:1 within the bank', () => {
    const ids = US_TECH.map((q: ExamQuestion) => contentIdentityFromQuestion(q));
    expect(new Set(ids).size).toBe(ids.length); // no collisions in the bank
  });
});