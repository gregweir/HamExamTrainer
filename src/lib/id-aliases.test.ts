import { describe, it, expect } from 'vitest';
import { buildAliases, resolveAlias } from './id-aliases.js';
import { contentIdentityFromQuestion } from './ident.js';
import type { ExamQuestion } from '../data/exam-banks.js';

// Synthetic questions standing in for two pool versions.
const q = (id: string, question: string, bank: ExamQuestion['bank'] = 'ca-advanced'): ExamQuestion => ({
  id, bank, section: 'C-001', question,
  choices: ['a', 'b', 'c', 'd'], correctIndex: 0, references: [],
  explanationStatus: 'none',
});

describe('id aliases across pool re-bases', () => {
  it('maps every native id of a version to its content identity', () => {
    const v1 = buildAliases('ca-advanced@2025', [q('C-001-001-001', 'What is a dipole antenna?')]);
    expect(v1.aliases['C-001-001-001']).toBe(
      contentIdentityFromQuestion(q('C-001-001-001', 'What is a dipole antenna?'))
    );
  });

  it('carries user progress across a re-base: the SAME text under a renumbered id resolves to the same identity', () => {
    // version 1: question "What is a dipole?" id C-001-001-001
    const v1 = buildAliases('ca-advanced@2025', [q('C-001-001-001', 'What is a dipole?')]);
    // version 2 (2026 re-base): same substance, renumbered id + punctuation drift
    const v2 = buildAliases('ca-advanced@2026', [q('C-001-002-007', 'What is a dipole.  ')]);
    const identity = resolveAlias('C-001-001-001', [v1, v2]);
    // the old id must still resolve; and v2's own id maps to the same identity
    expect(identity).not.toBeNull();
    expect(v2.aliases['C-001-002-007']).toBe(identity);
  });

  it('returns null for an id unknown to every version (a genuinely new question)', () => {
    const v1 = buildAliases('ca-advanced@2025', [q('C-001-001-001', 'What is a dipole?')]);
    expect(resolveAlias('C-999-999-999', [v1])).toBeNull();
  });
});
