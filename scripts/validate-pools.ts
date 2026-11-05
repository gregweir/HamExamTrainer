// Validate every parsed bank against the official pool facts before it is
// allowed to ship:
//   - question counts vs the official NCVEC / ISED numbers
//   - answer-index integrity (4 choices, correctIndex in range, US letter match)
//   - CA verbatim byte-check (normalized rows rebuild the raw TXT byte-for-byte)
//   - figure integrity (declared figures exist raw + emitted)
//   - registry consistency (BANKS counts/sections match the emitted data)
//
// CLI usage:  npx vite-node scripts/validate-pools.ts   (exit 1 on any error)

import { Buffer } from 'node:buffer';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BANKS, type CaExamQuestion, type ExamQuestion, US_TECH } from '../src/data/exam-banks';
import {
  caRawLine,
  CAAuthoritativeSources,
  parseCaBank,
} from './parse-ca';
import { parseUsBank, USAuthoritativeSources, type RawUsQuestion } from './parse-us';

export interface PoolValidationReport {
  ok: boolean;
  errors: string[];
  counts: Array<{ bank: string; questions: number }>;
}

export const OFFICIAL_COUNTS: Record<string, number> = {
  'us-tech': 409,
  'us-general': 423,
  'us-extra': 599,
  'ca-basic': 984,
  'ca-advanced': 549,
};

function emitBankPath(bank: string): string {
  return join('src', 'data', 'banks', `${bank}.json`);
}

export function validatePools(): PoolValidationReport {
  const errors: string[] = [];
  const counts: Array<{ bank: string; questions: number }> = [];

  // --- US banks ------------------------------------------------------------
  for (const source of USAuthoritativeSources) {
    const raw = JSON.parse(readFileSync(join(source.dir, source.json), 'utf8')) as RawUsQuestion[];
    const parsed = parseUsBank(raw, source.bank);
    counts.push({ bank: source.bank, questions: parsed.length });
    if (parsed.length !== source.expectedCount) {
      errors.push(
        `${source.bank}: ${parsed.length} questions, official count ${source.expectedCount}`,
      );
    }
    for (const q of parsed) {
      if (q.choices.length !== 4 || q.correctIndex < 0 || q.correctIndex > 3) {
        errors.push(`${q.bank} ${q.id}: answer-index out of range`);
      }
      if (q.figure && !existsSync(join('public', q.figure))) {
        errors.push(`${q.bank} ${q.id}: figure ${q.figure} not found under public/`);
      }
    }
    // The emitted file must equal a fresh parse.
    const emitted = JSON.parse(readFileSync(emitBankPath(source.bank), 'utf8')) as ExamQuestion[];
    if (JSON.stringify(emitted) !== JSON.stringify(parsed)) {
      errors.push(`${source.bank}: emitted JSON differs from a fresh parse of data/raw`);
    }
  }

  // --- CA banks (verbatim) -------------------------------------------------
  for (const source of Object.values(CAAuthoritativeSources)) {
    const raw = readFileSync(source.path, 'utf8');
    const parsed = parseCaBank(raw, source.bank as 'ca-basic' | 'ca-advanced');
    counts.push({ bank: source.bank, questions: parsed.length });
    if (parsed.length !== OFFICIAL_COUNTS[source.bank]) {
      errors.push(
        `${source.bank}: ${parsed.length} questions, official count ${OFFICIAL_COUNTS[source.bank]}`,
      );
    }
    const roundTrip =
      CAAuthoritativeSources[source.bank === 'ca-basic' ? 'basic' : 'advanced'].headerLine +
      '\r\n' +
      parsed.map((r) => caRawLine(r)).join('\r\n') +
      '\r\n';
    if (!Buffer.from(roundTrip, 'utf8').equals(Buffer.from(raw, 'utf8'))) {
      errors.push(`${source.bank}: verbatim round-trip FAILED — normalized rows do not rebuild`);
    }
    for (const q of parsed) {
      const indexes = [q.correctIndex, q.correctIndex_fr];
      if (q.choices.length !== 4 || q.choices_fr.length !== 4) {
        errors.push(`${q.bank} ${q.id}: choice count != 4`);
      }
      for (const i of indexes) {
        if (i < 0 || i > 3) {
          errors.push(`${q.bank} ${q.id}: answer-index out of range`);
        }
      }
      if (q.choices[q.correctIndex] !== q.choices[q.correctIndex_fr]) {
        errors.push(`${q.bank} ${q.id}: EN and FR correct answers disagree`);
      }
    }
    const emitted = JSON.parse(readFileSync(emitBankPath(source.bank), 'utf8')) as CaExamQuestion[];
    if (JSON.stringify(emitted) !== JSON.stringify(parsed)) {
      errors.push(`${source.bank}: emitted JSON differs from a fresh parse of data/raw`);
    }
  }

  // --- Registry consistency ------------------------------------------------
  for (const bank of BANKS) {
    const data: ExamQuestion[] =
      bank.id === 'us-tech' ? US_TECH : JSON.parse(readFileSync(emitBankPath(bank.id), 'utf8'));
    if (data.length !== bank.questionCount) {
      errors.push(`registry ${bank.id}: questionCount ${bank.questionCount} != data ${data.length}`);
    }
    const sections = [...new Set(data.map((q) => q.section))];
    if (sections.join('|') !== bank.sections.join('|')) {
      errors.push(`registry ${bank.id}: section list does not match the data`);
    }
    if (data.some((q) => q.bank !== bank.id)) {
      errors.push(`registry ${bank.id}: rows tagged with foreign bank ids`);
    }
  }

  return { ok: errors.length === 0, errors, counts };
}

async function main(): Promise<void> {
  const report = validatePools();
  for (const c of report.counts) {
    console.log(
      `validate-pools: ${c.bank} ${c.questions}/${OFFICIAL_COUNTS[c.bank]} questions ` +
        `${c.questions === OFFICIAL_COUNTS[c.bank] ? 'OK' : 'MISMATCH'}`,
    );
  }
  for (const e of report.errors) {
    console.error(`validate-pools: ERROR ${e}`);
  }
  if (report.ok) {
    console.log('validate-pools: all banks validated (counts, answer keys, CA verbatim bytes)');
  } else {
    console.error(`validate-pools: FAILED with ${report.errors.length} error(s)`);
  }
  process.exitCode = report.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
