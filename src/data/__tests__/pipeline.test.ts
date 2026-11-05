// @vitest-environment node
// Pool pipeline tests: run the parsers as functions over data/raw/ (node-only).
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CAAuthoritativeSources,
  caChoicePermutation,
  caRawLine,
  parseCaBank,
} from '../../../scripts/parse-ca';
import { parseUsBank } from '../../../scripts/parse-us';
import { validatePools } from '../../../scripts/validate-pools';
import {
  BANKS,
  CA_ADVANCED,
  CA_BASIC,
  bankBlock,
  type BankDefinition,
  type CaExamQuestion,
  type ExamBankId,
  type ExamQuestion,
  subsectionTitle,
  US_GENERAL,
  US_TECH,
} from '../exam-banks';
import sectionNames from '../section-names-ca.json';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');

const CA_BASIC_RAW_PATH = 'data/raw/ca/basic/amat_basic_quest_delim.txt';
const CA_ADVANCED_RAW_PATH = 'data/raw/ca/advanced/amat_adv_quest_delim.txt';
const US_RAW: Record<string, string> = {
  'us-tech': 'data/raw/us/technician-2026-2030/technician-2026-2030.json',
  'us-general': 'data/raw/us/general-2023-2027/general-2023-2027.json',
  'us-extra': 'data/raw/us/extra-2024-2028/extra-2024-2028.json',
};

const OFFICIAL_COUNTS: Record<string, number> = {
  'us-tech': 409,
  'us-general': 423,
  'us-extra': 599,
  'ca-basic': 984,
  'ca-advanced': 549,
};

const EMITTED_PATHS: Record<string, string> = {
  'us-tech': 'src/data/banks/us-tech.json',
  'us-general': 'src/data/banks/us-general.json',
  'us-extra': 'src/data/banks/us-extra.json',
  'ca-basic': 'src/data/banks/ca-basic.json',
  'ca-advanced': 'src/data/banks/ca-advanced.json',
};

function readRepo(rel: string): string {
  return readFileSync(join(repo, rel), 'utf8');
}

function assertQuestionShape(q: ExamQuestion, bank: string): void {
  expect(typeof q.id).toBe('string');
  expect(q.id.length).toBeGreaterThan(0);
  expect(q.bank).toBe(bank);
  expect(typeof q.section).toBe('string');
  expect(q.section.length).toBeGreaterThan(0);
  expect(typeof q.question).toBe('string');
  expect(q.question.length).toBeGreaterThan(0);
  expect(Array.isArray(q.choices)).toBe(true);
  expect(q.choices).toHaveLength(4);
  expect(q.correctIndex).toBeGreaterThanOrEqual(0);
  expect(q.correctIndex).toBeLessThanOrEqual(3);
  expect(Array.isArray(q.references)).toBe(true);
  expect(q.explanationStatus).toBe('none');
}

describe('CA parser — verbatim round-trip over the raw ISED bank', () => {
  it('parses all 984 Basic questions and all 549 Advanced questions', () => {
    const basic = parseCaBank(readRepo(CA_BASIC_RAW_PATH), 'ca-basic');
    expect(basic).toHaveLength(OFFICIAL_COUNTS['ca-basic']!);
    const advanced = parseCaBank(readRepo(CA_ADVANCED_RAW_PATH), 'ca-advanced');
    expect(advanced).toHaveLength(OFFICIAL_COUNTS['ca-advanced']!);
  });

  it('round-trips the raw Basic file byte-identically from the normalized rows', () => {
    const raw = readRepo(CA_BASIC_RAW_PATH);
    const rows = parseCaBank(raw, 'ca-basic');
    const roundTrip =
      CAAuthoritativeSources.basic.headerLine +
      '\r\n' +
      rows.map((r) => caRawLine(r)).join('\r\n') +
      '\r\n';
    expect(Buffer.from(roundTrip, 'utf8').equals(Buffer.from(raw, 'utf8'))).toBe(true);
  });

  it('round-trips the raw Advanced file byte-identically from the normalized rows', () => {
    const raw = readRepo(CA_ADVANCED_RAW_PATH);
    const rows = parseCaBank(raw, 'ca-advanced');
    const roundTrip =
      CAAuthoritativeSources.advanced.headerLine +
      '\r\n' +
      rows.map((r) => caRawLine(r)).join('\r\n') +
      '\r\n';
    expect(Buffer.from(roundTrip, 'utf8').equals(Buffer.from(raw, 'utf8'))).toBe(true);
  });

  it('ships byte-equal EN + FR texts and a deterministic permutation', () => {
    const raw = readRepo(CA_BASIC_RAW_PATH);
    const dataLines = raw.split('\r\n').filter(Boolean).slice(1);
    const rows = parseCaBank(raw, 'ca-basic');
    rows.forEach((row, i) => {
      const fields = dataLines[i]!.split(';');
      expect(fields).toHaveLength(11);
      expect(row.id).toBe(fields[0]);
      // Question text byte-equal in both languages.
      expect(row.question).toBe(fields[1]);
      expect(row.question_fr).toBe(fields[6]);
      // All four EN field texts appear byte-equal among the choices (shuffled order).
      const enRaw = [fields[2], fields[3], fields[4], fields[5]];
      const enRoundTrip = caChoicePermutation(row.id).map((k) => row.choices[k]!);
      expect(enRoundTrip).toEqual(enRaw);
      const frRaw = [fields[7], fields[8], fields[9], fields[10]];
      const frRoundTrip = caChoicePermutation(row.id).map((k) => row.choices_fr[k]!);
      expect(frRoundTrip).toEqual(frRaw);
      // correctIndex points at the raw correct answer.
      expect(row.choices[row.correctIndex]).toBe(fields[2]);
      expect(row.choices_fr[row.correctIndex_fr]).toBe(fields[7]);
      // The permutation is deterministic and a genuine reorder candidate.
      expect(caChoicePermutation(row.id).sort()).toEqual([0, 1, 2, 3]);
    });
  });

  it('derives the two-dotted section group from the question id', () => {
    const rows = parseCaBank(readRepo(CA_BASIC_RAW_PATH), 'ca-basic');
    expect(rows[0]!.id).toBe('B-001-001-001');
    expect(rows[0]!.section).toBe('B-001-001');
    const sections = new Set(rows.map((r) => r.section));
    for (const s of sections) {
      expect(s).toMatch(/^B-\d\d\d-\d\d\d$/);
    }
  });

  it('does not degenerate the correct answer into a single display position', () => {
    const rows = parseCaBank(readRepo(CA_BASIC_RAW_PATH), 'ca-basic');
    const byPosition: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const row of rows) {
      byPosition[row.correctIndex]! += 1;
    }
    // A regression back to identity order would collapse this to {0: 984}.
    expect(Object.keys(byPosition).filter((p) => byPosition[Number(p)]! > 0)).toHaveLength(4);
    // And no single position dominates: every position is used a real share.
    for (const count of Object.values(byPosition)) {
      expect(count).toBeGreaterThan(10);
    }
  });
});

// Only the two v1 banks are exported as typed data by the registry; the parked
// banks come straight from their emitted JSON files (same parse, same shape).
function emitted(bank: string): ExamQuestion[] {
  return JSON.parse(readRepo(EMITTED_PATHS[bank]!)) as ExamQuestion[];
}
function usBankQuestions(bank: string): ExamQuestion[] {
  return bank === 'us-tech' ? US_TECH : emitted(bank);
}

describe('US parser — russolsen NCVEC pools', () => {
  it('parses the official question counts', () => {
    for (const [bank, count] of Object.entries(OFFICIAL_COUNTS)) {
      const questions = bank.startsWith('ca-')
        ? parseCaBank(
            readRepo(bank === 'ca-basic' ? CA_BASIC_RAW_PATH : CA_ADVANCED_RAW_PATH),
            bank as 'ca-basic' | 'ca-advanced',
          )
        : parseUsBank(JSON.parse(readRepo(US_RAW[bank]!)), bank as ExamBankId);
      expect(questions).toHaveLength(count);
    }
    expect(US_TECH).toHaveLength(OFFICIAL_COUNTS['us-tech']!);
  });

  it('keeps native ids, the three-letter section, and 4 choices with in-range answers', () => {
    for (const [bank, questions] of [
      ['us-tech', US_TECH],
      ['us-general', emitted('us-general')],
      ['us-extra', emitted('us-extra')],
    ] as Array<[string, ExamQuestion[]]>) {
      expect(questions.length).toBeGreaterThan(0);
      questions.forEach((q) => {
        assertQuestionShape(q, bank);
        expect(q.id).toMatch(/^\w\d\w\d\d$/);
        expect(q.section).toBe(q.id.slice(0, 3));
      });
    }
  });

  it('resolves each declared figure to an existing raw file — and an emitted public copy for every bank with figures', () => {
    const bankDirs: Record<string, string> = {
      'us-tech': 'data/raw/us/technician-2026-2030',
      'us-general': 'data/raw/us/general-2023-2027',
      'us-extra': 'data/raw/us/extra-2024-2028',
    };
    // all three US banks ship figures (ca banks carry none)
    expect(BANKS.map((b) => b.id)).toEqual(['us-tech', 'us-general', 'us-extra', 'ca-basic', 'ca-advanced']);
    for (const [bank, questions] of [
      ['us-tech', US_TECH],
      ['us-general', emitted('us-general')],
      ['us-extra', emitted('us-extra')],
    ] as Array<[string, ExamQuestion[]]>) {
      const declared = questions.filter((q) => q.figure);
      expect(declared.length).toBeGreaterThan(0);
      for (const q of declared) {
        const file = q.figure!.split('/').pop();
        expect(existsSync(join(repo, bankDirs[bank]!, file!))).toBe(true);
        // figure path is bundle-relative: public/<figure> is the served file.
        expect(q.figure).toMatch(/^figures\//);
        expect(existsSync(join(repo, 'public', q.figure!))).toBe(true);
      }
    }
  });

  it('preserves the official answer key (letter cross-check against raw JSON)', () => {
    for (const [bank, path] of Object.entries(US_RAW)) {
      const raw = JSON.parse(readRepo(path)) as Array<{
        id: string;
        correct: number;
        correct_letter: string;
      }>;
      const parsed = usBankQuestions(bank);
      expect(parsed.length).toBe(raw.length);
      for (let i = 0; i < raw.length; i += 1) {
        expect(parsed[i]!.id).toBe(raw[i]!.id);
        expect(parsed[i]!.choices[raw[i]!.correct]).toBe(
          parsed[i]!.choices[parsed[i]!.correctIndex],
        );
        expect('ABCD'[raw[i]!.correct]).toBe(raw[i]!.correct_letter);
      }
    }
  });
});

describe('emitted bank JSON matches what the parsers produce', () => {
  it('emitted us-tech / us-general / us-extra equal a fresh parse', () => {
    for (const [bank, rawPath] of Object.entries(US_RAW)) {
      const fromRegistry = usBankQuestions(bank);
      expect(JSON.parse(JSON.stringify(fromRegistry))).toEqual(
        JSON.parse(readRepo(EMITTED_PATHS[bank]!)),
      );
      expect(fromRegistry).toEqual(parseUsBank(JSON.parse(readRepo(rawPath)), bank as ExamBankId));
    }
  });

  it('emitted ca-basic / ca-advanced equal a fresh parse', () => {
    const advancedBank = 'ca-advanced';
    expect(parseCaBank(readRepo(CA_ADVANCED_RAW_PATH), advancedBank)).toEqual(
      JSON.parse(readRepo(EMITTED_PATHS[advancedBank]!)),
    );
    expect(JSON.parse(JSON.stringify(CA_BASIC))).toEqual(
      JSON.parse(readRepo(EMITTED_PATHS['ca-basic']!)),
    );
    expect(CA_BASIC).toEqual(parseCaBank(readRepo(CA_BASIC_RAW_PATH), 'ca-basic'));
  });
});

describe('answer-index integrity across every bank', () => {
  it('every question id is unique within its bank', () => {
    for (const [bank, questions] of [
      ['us-tech', US_TECH],
      ['us-general', emitted('us-general')],
      ['us-extra', emitted('us-extra')],
      ['ca-basic', CA_BASIC],
      ['ca-advanced', emitted('ca-advanced')],
    ] as Array<[string, ExamQuestion[]]>) {
      const ids = questions.map((q) => q.id);
      expect(new Set(ids).size, bank).toBe(ids.length);
    }
  });

  it('every question has exactly 4 choices and an in-range correctIndex (EN and FR)', () => {
    const all: ExamQuestion[] = [US_TECH, emitted('us-general'), emitted('us-extra'), CA_BASIC].flat();
    expect(all.length).toBe(OFFICIAL_COUNTS['us-tech']! + OFFICIAL_COUNTS['us-general']! +
      OFFICIAL_COUNTS['us-extra']! + OFFICIAL_COUNTS['ca-basic']!);
    for (const q of all) {
      assertQuestionShape(q, q.bank);
      if ('choices_fr' in q) {
        const ca = q as CaExamQuestion;
        expect(ca.choices_fr).toHaveLength(4);
        expect(ca.correctIndex_fr).toBeGreaterThanOrEqual(0);
        expect(ca.correctIndex_fr).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('bank registry', () => {
  it('ships all five banks with exact exam rules, counts and section lists', () => {
    expect(BANKS.map((b) => b.id)).toEqual(['us-tech', 'us-general', 'us-extra', 'ca-basic', 'ca-advanced']);
    const by = (id: string): BankDefinition => BANKS.find((b) => b.id === id)!;
    const tech = by('us-tech');
    const basic = by('ca-basic');
    expect(tech.questionCount).toBe(409);
    expect(tech.examLength).toBe(35);
    expect(tech.passPercent).toBe(74);
    expect(tech.honoursPercent).toBeUndefined();
    expect(basic.questionCount).toBe(984);
    expect(basic.examLength).toBe(100);
    // Corrected ISED rule: 70% pass, Honours certificate at 80%.
    expect(basic.passPercent).toBe(70);
    expect(basic.honoursPercent).toBe(80);
    expect(tech.sections.length).toBe(35);
    expect(basic.sections.length).toBe(new Set(CA_BASIC.map((q) => q.section)).size);
    expect(new Set(tech.sections)).toEqual(new Set(US_TECH.map((q) => q.section)));
    expect(new Set(basic.sections)).toEqual(new Set(CA_BASIC.map((q) => q.section)));
    for (const b of BANKS) {
      expect(b.title.length).toBeGreaterThan(0);
      expect(b.subtitle.length).toBeGreaterThan(0);
      expect(b.bookCta.label.length).toBeGreaterThan(0);
      expect(b.bookCta.href.startsWith('https://radiobook.ca/')).toBe(true);
    }
    // Book CTAs per the plan (Tech/Basic/Advanced→Book 3, General→Book 2, Extra→Book 5).
    expect(tech.bookCta.href).toBe('https://radiobook.ca/b3');
    expect(by('us-general').bookCta.href).toBe('https://radiobook.ca/b2');
    expect(by('us-extra').bookCta.href).toBe('https://radiobook.ca/b5');
    expect(basic.bookCta.href).toBe('https://radiobook.ca/b3');
    expect(by('ca-advanced').bookCta.href).toBe('https://radiobook.ca/b5');
  });

});

describe('ISED UI title metadata', () => {
  it('covers every CA subsection and block id in both banks, no leftovers', () => {
    const names = sectionNames as unknown as Record<string, { blocks: Record<string, string>; subsections: Record<string, string> }>;
    for (const [bankId, data] of Object.entries({ 'ca-basic': CA_BASIC, 'ca-advanced': CA_ADVANCED })) {
      const subs = [...new Set((data as ExamQuestion[]).map(q => q.section))];
      const blocks = [...new Set(subs.map(s => s.slice(0, 5)))];
      const { blocks: namedBlocks, subsections: namedSubs } = names[bankId]!;
      for (const id of blocks) expect(namedBlocks[id], `${bankId} block ${id}`).toBeTruthy();
      for (const id of subs) expect(namedSubs[id], `${bankId} subsection ${id}`).toBeTruthy();
      for (const id of Object.keys(namedBlocks)) expect(blocks, `${bankId} block leftover ${id}`).toContain(id);
      for (const id of Object.keys(namedSubs)) expect(subs, `${bankId} subsection leftover ${id}`).toContain(id);
    }
  });

  it('US banks get no CA-derived titles (their syllabus names already carry them)', () => {
    expect(subsectionTitle('us-tech', 'T0A')).toBeNull();
    expect(bankBlock('us-tech', 'T0A-01')).toBeNull();
  });
});

describe('validatePools', () => {
  it('reports zero errors across all five banks', () => {
    const report = validatePools();
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(Object.fromEntries(report.counts.map((c) => [c.bank, c.questions]))).toEqual(
      OFFICIAL_COUNTS,
    );
  });
});
