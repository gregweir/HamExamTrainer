/**
 * Content-identity keys — how user progress survives pool re-bases.
 *
 * Both banks re-base on their own schedules (NCVEC every 3 years; ISED's CA
 * Advanced is expected to be re-written in 2026). Question ids are stable
 * WITHIN a pool version but the id alone is a fragile key for user progress:
 * a re-base can renumber or reshuffle ids. So the progress layer keys on the
 * question's SUBSTANCE: bank + section + normalized question text (hash).
 *
 * A per-pool-version alias map (id-aliases.ts) bridges the bank's native id to
 * its identity so lookups stay O(1) while remaining migration-proof.
 */

/** The hash input for a question's stable identity. */
export interface IdentityInput {
  bank: string;
  section: string;
  text: string;
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

/** The stable progress key for a question: bank + section + normalized text. */
export function contentIdentity(bank: string, section: string, text: string): string {
  const norm = normalizeQuestionText(text);
  return `${bank}:${section}:${fnv1a(norm)}`;
}

/**
 * Convenience for a normalized question object. NOTE: prefers the ENGLISH
 * question text (US pools are EN; CA banks carry EN+FR in one row — EN is the
 * keying substance so FR/EN versions of the same question MUST share progress).
 */
export function contentIdentityFromQuestion(q: {
  bank: string;
  section: string;
  question: string;
}): string {
  return contentIdentity(q.bank, q.section, q.question);
}
