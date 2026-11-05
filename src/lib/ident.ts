/**
 * Content-identity keys — how user progress survives pool re-bases.
 *
 * Both banks re-base on their own schedules (NCVEC every 3 years; ISED's CA
 * Advanced is expected to be re-written in 2026). Question ids are stable
 * WITHIN a pool version but the id alone is a fragile key for user progress:
 * a re-base can renumber or reshuffle ids. So the progress layer keys on the
 * question's SUBSTANCE: bank + section + normalized question text + the
 * SORTED, normalized choice texts (hash).
 *
 * The choices fold in because ISED's bank legitimately ships multiple DISTINCT
 * questions with identical question text but different choices — text alone
 * would merge their progress. Choices join the hash SORTED (not presented
 * order) so a display permutation drifts nothing, and correctIndex is
 * deliberately NOT part of the hash (the answer position is not substance).
 *
 * A per-pool-version alias map (id-aliases.ts) bridges the bank's native id to
 * its identity so lookups stay O(1) while remaining migration-proof.
 */

/** The hash input for a question's stable identity. */
export interface IdentityInput {
  bank: string;
  section: string;
  text: string;
  choices?: string[];
}

/**
 * Normalize question text into its comparable form:
 * NFC, lowercase, straight quotes, collapsed whitespace, trailing
 * punctuation-only differences removed. Deliberately NOT aggressive (the
 * text itself, and its numbers, are substance and stay).
 */
export function normalizeQuestionText(raw: string): string {
  let s = raw.normalize('NFC').toLowerCase();
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  s = s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/[.!?,;:]+$/u, '');
  return s;
}

/** FNV-1a 32-bit → hex. Collision risk over a bank is negligible (409-984 items). */
function fnv1a(s: string): string {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * The stable progress key for a question: bank + section + normalized text +
 * the SORTED normalized choice set. `choices` is OPTIONAL so callers built on
 * older bank data (aliases emitted from pre-choices keys) keep compiling and
 * resolving: a legacy alias key (bank+section+text) simply never folds the
 * choices in.
 */
export function contentIdentity(bank: string, section: string, text: string, choices?: string[]): string {
  const parts = [normalizeQuestionText(text)];
  if (choices) {
    const all = choices.map(normalizeQuestionText).sort();
    const joined = all.join('\u001f');
    parts.push(joined);
  }
  return `${bank}:${section}:${fnv1a(parts.join('\u001e'))}`;
}

/**
 * Convenience for a normalized question object. NOTE: prefers the ENGLISH
 * question text and choices (US pools are EN; CA banks carry EN+FR in one row
 * — EN is the keying substance so FR/EN versions of the same question MUST
 * share progress). correctIndex never enters the hash: the identity is
 * position-stable across choice permutations.
 */
export function contentIdentityFromQuestion(q: {
  bank: string;
  section: string;
  question: string;
  choices?: string[];
}): string {
  return contentIdentity(q.bank, q.section, q.question, q.choices);
}
