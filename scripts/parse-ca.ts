// Parse the ISED (Canada) semicolon-delimited question banks into normalized rows.
//
// Legal framing (see docs/specs + data/raw/SOURCES.md): the CA bank text ships
// VERBATIM (Crown copyright permits unaltered reproduction with attribution).
// This parser therefore never rewrites a string — it only splits on the ';'
// delimiter and stores the raw fields byte-for-byte. The only normalization is
// presentation order: the delimited file always lists the correct answer first
// (its own dedicated field), so choices are re-ordered with a deterministic,
// id-seeded permutation so the shipped correctIndex is not always 0. Re-running
// the parser reproduces the exact same order for a given bank version.
//
// CLI usage:  npx vite-node scripts/parse-ca.ts [repoRoot?]
// Emits src/data/banks/ca-basic.json and src/data/banks/ca-advanced.json.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaExamQuestion, ExamBankId } from '../src/data/exam-banks';

export interface CAAuthoritativeSource {
  headerLine: string;
  path: string; // repo-relative path to the authoritative TXT
  url: string; // ISED download URL the data is reproduced from
  bank: ExamBankId;
}

/**
 * The authoritative ISED rows (header line stamped so the verbatim round-trip
 * can be checked against the file byte-for-byte). Keep in sync with
 * data/raw/SOURCES.md.
 */
export const CAAuthoritativeSources: Record<'basic' | 'advanced', CAAuthoritativeSource> = {
  basic: {
    headerLine:
      'question_id ;question_english;correct_answer_english;incorrect_answer_1_english;incorrect_answer_2_english;incorrect_answer_3_english;question_french;correct_answer_french;incorrect_answer_1_french;incorrect_answer_2_french;incorrect_answer_3_french',
    path: 'data/raw/ca/basic/amat_basic_quest_delim.txt',
    url: 'https://apc-cap.ic.gc.ca/datafiles/amat_basic_quest.zip',
    bank: 'ca-basic',
  },
  advanced: {
    headerLine:
      'question_id ;question_english;correct_answer_english;incorrect_answer_1_english;incorrect_answer_2_english;incorrect_answer_3_english;question_french;correct_answer_french;incorrect_answer_1_french;incorrect_answer_2_french;incorrect_answer_3_french',
    path: 'data/raw/ca/advanced/amat_adv_quest_delim.txt',
    url: 'https://apc-cap.ic.gc.ca/datafiles/amat_adv_quest.zip',
    bank: 'ca-advanced',
  },
};

/** FNV-1a 32-bit hash of the question id — the pool-version-stable shuffle seed. */
function idHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic permutation of the four raw EN/FR answer fields.
 * `perm[k]` is the display position given to raw answer field k (raw field 0 is
 * the correct answer); reconstruct the raw order via `perm.map(k => choices[k])`.
 */
export function caChoicePermutation(id: string): number[] {
  let s = idHash(id);
  const perm = [0, 1, 2, 3];
  for (let i = perm.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 48271) + 11) >>> 0;
    const j = s % (i + 1);
    const tmp = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = tmp;
  }
  return perm;
}

const EXPECTED_FIELDS = 11;

/**
 * Parse a full delimited ISED bank file (UTF-8, CRLF rows, ';' fields).
 * Returns normalized bilingual questions; no string in the output differs from
 * the raw fields.
 */
export function parseCaBank(raw: string, bank: 'ca-basic' | 'ca-advanced'): CaExamQuestion[] {
  const body = raw.endsWith('\r\n') ? raw.slice(0, -2) : raw.trimEnd();
  const lines = body.split('\r\n');
  const header = lines[0]!;
  const expectedHeader = CAAuthoritativeSources[bank === 'ca-basic' ? 'basic' : 'advanced']
    .headerLine;
  if (header !== expectedHeader) {
    throw new Error(
      `CA bank header mismatch for ${bank}: unexpected field layout (see scripts/parse-ca.ts).`,
    );
  }
  const rows: CaExamQuestion[] = [];
  for (const line of lines.slice(1)) {
    if (line.trim() === '') {
      continue;
    }
    const fields = line.split(';');
    if (fields.length !== EXPECTED_FIELDS) {
      const id = fields[0] ?? line.slice(0, 20);
      throw new Error(
        `${bank} row ${id}: expected ${EXPECTED_FIELDS} ';'-split fields, got ${fields.length}. ` +
          'Field splitting must stay verbatim; report this to the controller instead of papering over it.',
      );
    }
    const id = fields[0]!;
    const enQuestion = fields[1]!;
    const enCorrect = fields[2]!;
    const enIncorrect = [fields[3]!, fields[4]!, fields[5]!];
    const frQuestion = fields[6]!;
    const frCorrect = fields[7]!;
    const frIncorrect = [fields[8]!, fields[9]!, fields[10]!];

    const perm = caChoicePermutation(id);
    const correctDisplay = perm[0]!; // display position of the raw correct field
    const rawEn = [enCorrect, ...enIncorrect];
    const rawFr = [frCorrect, ...frIncorrect];
    const choices: string[] = new Array(4);
    const choicesFr: string[] = new Array(4);
    perm.forEach((display, k) => {
      choices[display] = rawEn[k]!;
      choicesFr[display] = rawFr[k]!;
    });
    rows.push({
      id,
      bank,
      section: caSectionOf(id),
      question: enQuestion,
      choices,
      correctIndex: correctDisplay,
      references: [],
      explanationStatus: 'none',
      question_fr: frQuestion,
      choices_fr: choicesFr,
      correctIndex_fr: correctDisplay,
    });
  }
  return rows;
}

/** "B-001-002-001" → "B-001-002" (the id's section groups, last field dropped). */
export function caSectionOf(id: string): string {
  const groups = id.split('-');
  if (groups.length !== 4) {
    throw new Error(`CA question id is not in the expected 4-group form: "${id}"`);
  }
  return groups.slice(0, 3).join('-');
}

/** Rebuild the raw TXT line of a normalized row (used by the verbatim check). */
export function caRawLine(row: CaExamQuestion): string {
  const perm = caChoicePermutation(row.id);
  const rawEn = perm.map((k) => row.choices[k]!);
  const rawFr = perm.map((k) => row.choices_fr[k]!);
  return [
    row.id,
    row.question,
    rawEn[0],
    rawEn[1],
    rawEn[2],
    rawEn[3],
    row.question_fr,
    rawFr[0],
    rawFr[1],
    rawFr[2],
    rawFr[3],
  ].join(';');
}

function emit(bankName: 'basic' | 'advanced'): void {
  const source = CAAuthoritativeSources[bankName];
  const raw = readFileSync(source.path, 'utf8');
  const rows = parseCaBank(raw, source.bank as 'ca-basic' | 'ca-advanced');
  const outPath = join('src', 'data', 'banks', `${source.bank}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(rows, null, 2) + '\n');
  console.log(`parse-ca: emitted ${outPath} (${rows.length} questions, ${source.url})`);
}

async function main(): Promise<void> {
  emit('basic');
  emit('advanced');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
