// Parse the russolsen-packaged NCVEC (US) pool JSONs into normalized rows.
//
// The raw JSON (one record per question, Apache-2.0 packaging over NCVEC
// public-domain text) carries: id, correct (0-based), refs, question,
// answers[4], figure ("", or a PNG filename relative to the pool directory)
// and the redundant correct_letter. Question text, question order, and answer
// order are preserved as shipped; the only normalization is:
//   - section derived from the native id ("T1A01" → "T1A")
//   - refs "[97.301, 97.207(c)]" → ["97.301", "97.207(c)"] ([] when empty)
//   - figure rewritten to its bundle-relative path under public/
//
// CLI usage:  npx vite-node scripts/parse-us.ts
// Emits src/data/banks/us-{tech,general,extra}.json and copies each pool's
// figure PNGs to public/figures/<bank>/.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExamBankId, ExamQuestion } from '../src/data/exam-banks';

export interface UsAuthoritativeSource {
  bank: ExamBankId; // 'us-tech' | 'us-general' | 'us-extra'
  dir: string; // repo-relative pool directory (raw JSON + figure PNGs)
  json: string; // pool JSON filename
  url: string; // authoritative source the data ships from
  expectedCount: number; // official NCVEC count for this element
}

/** The three NCVEC pools (see data/raw/SOURCES.md). */
export const USAuthoritativeSources: UsAuthoritativeSource[] = [
  {
    bank: 'us-tech',
    dir: 'data/raw/us/technician-2026-2030',
    json: 'technician-2026-2030.json',
    url: 'https://github.com/russolsen/ham_radio_question_pool (current pools per ncvec.org)',
    expectedCount: 409,
  },
  {
    bank: 'us-general',
    dir: 'data/raw/us/general-2023-2027',
    json: 'general-2023-2027.json',
    url: 'https://github.com/russolsen/ham_radio_question_pool (current pools per ncvec.org)',
    expectedCount: 423,
  },
  {
    bank: 'us-extra',
    dir: 'data/raw/us/extra-2024-2028',
    json: 'extra-2024-2028.json',
    url: 'https://github.com/russolsen/ham_radio_question_pool (current pools per ncvec.org)',
    expectedCount: 599,
  },
];

/** One record of the russolsen pool JSON. */
export interface RawUsQuestion {
  id: string;
  correct: number;
  refs: string;
  question: string;
  answers: string[];
  figure: string;
  correct_letter: string;
}

/** "[97.301, 97.207(c)]" → ["97.301", "97.207(c)"]; "" → []. */
export function usReferences(refs: string): string[] {
  const trimmed = refs.trim();
  if (trimmed === '') {
    return [];
  }
  const inner = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
  return inner
    .split(', ')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}

const LETTERS = ['A', 'B', 'C', 'D'];

export function parseUsBank(rawQuestions: RawUsQuestion[], bank: ExamBankId): ExamQuestion[] {
  return rawQuestions.map((q) => {
    if (!Array.isArray(q.answers) || q.answers.length !== 4) {
      throw new Error(`${bank} question ${q.id}: expected 4 answers, got ${q.answers?.length}`);
    }
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) {
      throw new Error(`${bank} question ${q.id}: correct index ${q.correct} out of range 0-3`);
    }
    if (LETTERS[q.correct!] !== q.correct_letter) {
      throw new Error(
        `${bank} question ${q.id}: correct index ${q.correct} contradicts correct_letter "${q.correct_letter}"`,
      );
    }
    const out: ExamQuestion = {
      id: q.id,
      bank,
      section: q.id.slice(0, Math.max(0, q.id.length - 2)),
      question: q.question,
      choices: [...q.answers],
      correctIndex: q.correct,
      references: usReferences(q.refs ?? ''),
      explanationStatus: 'none',
    };
    if (q.figure && q.figure.trim() !== '') {
      out.figure = `figures/${bank}/${q.figure}`;
    }
    return out;
  });
}

function emitFigures(dir: string, bank: ExamBankId, figures: string[]): void {
  const outDir = join('public', 'figures', bank);
  mkdirSync(outDir, { recursive: true });
  for (const file of figures) {
    copyFileSync(join(dir, file), join(outDir, file));
  }
}

function emit(source: UsAuthoritativeSource): void {
  const rawPath = join(source.dir, source.json);
  const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as RawUsQuestion[];
  if (raw.length !== source.expectedCount) {
    throw new Error(
      `${source.bank}: pool has ${raw.length} questions, official count is ${source.expectedCount}. ` +
        'Refusing to emit a bank with a count mismatch.',
    );
  }
  const rows = parseUsBank(raw, source.bank);
  const outPath = join('src', 'data', 'banks', `${source.bank}.json`);
  mkdirSync('src/data/banks', { recursive: true });
  writeFileSync(outPath, JSON.stringify(rows, null, 2) + '\n');
  const figures = [...new Set(raw.map((q) => q.figure).filter((f) => f && f.trim() !== ''))];
  emitFigures(source.dir, source.bank, figures);
  console.log(
    `parse-us: emitted ${outPath} (${rows.length} questions, ${figures.length} figures)`,
  );
}

async function main(): Promise<void> {
  for (const source of USAuthoritativeSources) {
    emit(source);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
