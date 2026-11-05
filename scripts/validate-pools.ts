// Validate every parsed bank against the official pool facts before it is
// allowed to ship:
//   - question counts vs the official NCVEC / ISED numbers
//   - unique question ids per bank
//   - answer-index integrity (4 choices, correctIndex in range, US letter match)
//   - CA verbatim byte-check (normalized rows rebuild the raw TXT byte-for-byte)
//   - CA EN/FR correct-answer pairing against the raw fields
//   - figure integrity (declared figures exist raw + emitted)
//   - registry consistency (BANKS counts/sections match the data; parked banks
//     counts stay honest for their flip-on)
//   - content-identity uniqueness per bank (same-stem variants with different
//     choices must stay distinct; only true duplicate rows may merge)
//
// CLI usage:  npx vite-node --script scripts/validate-pools.ts   (exit 1 on any error)

import { Buffer } from 'node:buffer';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BANKS,
  type CaExamQuestion,
  type ExamQuestion,
  type BankDefinition,
} from '../src/data/exam-banks';
import {
  caRawLine,
  CAAuthoritativeSources,
  parseCaBank,
} from './parse-ca';
import { parseUsBank, USAuthoritativeSources, type RawUsQuestion } from './parse-us';
import {
  contentIdentityFromQuestion,
  normalizeQuestionText,
} from '../src/lib/ident';

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

function emitBank<T>(bank: string): T {
  return JSON.parse(readFileSync(emitBankPath(bank), 'utf8')) as T;
}

/** Question ids must be unique within a bank — progress records key on them. */
function checkUniqueId(bank: string, questions: ExamQuestion[], errors: string[]): void {
  const seen = new Set<string>();
  for (const q of questions) {
    if (seen.has(q.id)) {
      errors.push(`${bank}: duplicate question id ${q.id}`);
    }
    seen.add(q.id);
  }
}

/**
 * Content identities (see src/lib/ident.ts) must be unique per bank: a
 * collision merges unrelated questions' user progress. The one permissible
 * collision is a TRUE duplicate row — same normalized stem, same choice set,
 * same correct answer text, differing only in the presented choice order
 * (today: ca-basic B-001-019-004/-006). Anything else fails the bank.
 */
function checkUniqueIdentity(bank: string, questions: ExamQuestion[], errors: string[]): void {
  const groups = new Map<string, ExamQuestion[]>();
  for (const q of questions) {
    const identity = contentIdentityFromQuestion(q);
    const list = groups.get(identity) ?? [];
    list.push(q);
    groups.set(identity, list);
  }
  for (const [identity, group] of groups) {
    if (group.length === 1) continue;
    const correctText = (q: ExamQuestion) =>
      normalizeQuestionText(q.choices[q.correctIndex] ?? '');
    const trueDupe =
      new Set(group.map((q) => normalizeQuestionText(q.question))).size === 1 &&
      new Set(group.map((q) => q.choices.map(normalizeQuestionText).sort().join('\u001f'))).size === 1 &&
      new Set(group.map(correctText)).size === 1;
    if (trueDupe) continue;
    errors.push(
      `${bank}: content-identity collision ${identity} merges DISTINCT questions ` +
        group.map((q) => q.id).join('+'),
    );
  }
}

export function validatePools(): PoolValidationReport {
  const errors: string[] = [];
  const counts: Array<{ bank: string; questions: number }> = [];
  // Shipped banks bundle their figures under public/ (so they precache);
  // PARKED banks keep only the raw figure files on disk.
  const shippedIds = new Set(BANKS.map((b) => b.id));

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
      if (q.figure && !existsSync(join(source.dir, q.figure.split('/').pop()!))) {
        errors.push(`${q.bank} ${q.id}: figure ${q.figure} not found raw`);
      }
      if (q.figure && shippedIds.has(source.bank) && !existsSync(join('public', q.figure))) {
        errors.push(`${q.bank} ${q.id}: figure ${q.figure} not found under public/`);
      }
    }
    checkUniqueId(source.bank, parsed, errors);
    // The emitted file must equal a fresh parse.
    const emitted = emitBank<ExamQuestion[]>(source.bank);
    checkUniqueId(source.bank, emitted, errors);
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
      if (q.choices.length !== 4 || q.choices_fr.length !== 4) {
        errors.push(`${q.bank} ${q.id}: choice count != 4`);
      }
      for (const i of [q.correctIndex, q.correctIndex_fr]) {
        if (i < 0 || i > 3) {
          errors.push(`${q.bank} ${q.id}: answer-index out of range`);
        }
      }
    }
    checkUniqueId(source.bank, parsed, errors);
    // EN/FR pairing, checked against the RAW fields (independent of the parser):
    // the EN correct string must sit at the emitted correctIndex and the FR
    // correct string at correctIndex_fr — the same display position for both
    // languages. Fires if the EN and FR arrays ever get divergent permutations.
    const emitted = emitBank<CaExamQuestion[]>(source.bank);
    checkUniqueId(source.bank, emitted, errors);
    const dataLines = raw
      .slice(0, raw.endsWith('\r\n') ? -2 : undefined)
      .split('\r\n')
      .slice(1)
      .filter((line) => line.trim() !== '');
    if (emitted.length !== dataLines.length) {
      errors.push(`${source.bank}: emitted row count != raw row count`);
    }
    for (let i = 0; i < Math.min(emitted.length, dataLines.length); i += 1) {
      const fields = dataLines[i]!.split(';');
      const q = emitted[i]!;
      if (q.choices[q.correctIndex] !== fields[2]) {
        errors.push(`${q.bank} ${q.id}: EN correct answer does not pair with its raw field`);
      }
      if (q.choices_fr[q.correctIndex_fr] !== fields[7]) {
        errors.push(`${q.bank} ${q.id}: FR correct answer does not pair with its raw field`);
      }
      if (q.correctIndex !== q.correctIndex_fr) {
        errors.push(`${q.bank} ${q.id}: EN and FR correct answers sit at different display positions`);
      }
    }
    if (JSON.stringify(emitted) !== JSON.stringify(parsed)) {
      errors.push(`${source.bank}: emitted JSON differs from a fresh parse of data/raw`);
    }
  }

  // --- Registry consistency ------------------------------------------------
  //
  // PARKED banks are no longer bundled (their JSONs stay on disk, still
  // validated above against the raw pools), so their registry rules live here
  // as the flip-on source. When a bank ships (one import + one BANKS entry in
  // src/data/exam-banks.ts), delete its row here.
  const bankRules: { id: string; questionCount: number; examLength: number }[] = [
    { id: 'us-tech', questionCount: 409, examLength: 35 },
    { id: 'ca-basic', questionCount: 984, examLength: 100 },
    { id: 'us-general', questionCount: 423, examLength: 35 },
    { id: 'us-extra', questionCount: 599, examLength: 50 },
    { id: 'ca-advanced', questionCount: 549, examLength: 50 },
  ];
  const bankData: Record<string, ExamQuestion[]> = {
    'us-tech': emitBank<ExamQuestion[]>('us-tech'),
    'us-general': emitBank<ExamQuestion[]>('us-general'),
    'us-extra': emitBank<ExamQuestion[]>('us-extra'),
    'ca-basic': emitBank<CaExamQuestion[]>('ca-basic'),
    'ca-advanced': emitBank<CaExamQuestion[]>('ca-advanced'),
  };
  for (const rule of bankRules) {
    const data = bankData[rule.id]!;
    if (data.length !== rule.questionCount) {
      errors.push(`registry ${rule.id}: questionCount ${rule.questionCount} != data ${data.length}`);
    }
    if (shippedIds.has(rule.id as BankDefinition['id'])) {
      // full registry rules for shipped banks come straight from BANKS
      const bank = BANKS.find((b) => b.id === rule.id)!;
      const sections = [...new Set(data.map((q) => q.section))];
      if (sections.join('|') !== bank.sections.join('|')) {
        errors.push(`registry ${bank.id}: section list does not match the data`);
      }
      if (data.some((q) => q.bank !== bank.id)) {
        errors.push(`registry ${bank.id}: rows tagged with foreign bank ids`);
      }
      if (bank.examLength > bank.questionCount) {
        errors.push(`registry ${bank.id}: examLength ${bank.examLength} exceeds ${bank.questionCount}`);
      }
      checkUniqueIdentity(bank.id, data, errors);
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
