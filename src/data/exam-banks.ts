// Bank registry — the single place every UI/progress task imports bank data from.
//
// The normalized question schema below is pinned by the design spec
// (docs/specs/2026-11-05-tartanleaf-ham-exam-trainer-design.md) and is produced
// byte-for-byte by scripts/parse-us.ts and scripts/parse-ca.ts.

import caBasicData from './banks/ca-basic.json';
import usTechData from './banks/us-tech.json';

/**
 * Bank ids, mirroring the spec's union. Only the SHIPPED banks may appear in
 * BANKS below; the parked ids exist so the type stays stable for the flip-on.
 */
export type ExamBankId =
  | 'us-tech'
  | 'us-general'
  | 'us-extra'
  | 'ca-basic'
  | 'ca-basic-honours'
  | 'ca-advanced';

/** Internal normalized question schema — exactly the design's ExamQuestion. */
export interface ExamQuestion {
  id: string; // bank-scoped stable id, native to the pool ("T1A01", "B-001-001-001")
  bank: ExamBankId;
  section: string; // syllabus/section id, e.g. "T1A" (US) or "B-001-001" (CA)
  question: string;
  choices: string[]; // full texts, presented order
  correctIndex: number;
  figure?: string; // bundle-relative, e.g. "figures/us-tech/t-1.png"
  references: string[]; // official reference codes
  explanation?: string; // written by the RadioBook team (separate sidecar layer)
  explanationStatus: 'none' | 'draft' | 'reviewed';
}

/**
 * Canadian Basic/Advanced questions additionally carry the verbatim French
 * strings from the same ISED row (data sub-fields, not a separate bank).
 * The EN and FR choices share the same presentation permutation.
 */
export interface CaExamQuestion extends ExamQuestion {
  question_fr: string;
  choices_fr: string[];
  correctIndex_fr: number;
}

/** Book "reading" CTA — a plain ungated link into the RadioBook series. */
export interface BookCta {
  label: string;
  href: string;
}

/** Exam definition metadata the UI and simulator compute from. */
export interface BankDefinition {
  id: ExamBankId;
  title: string;
  subtitle: string;
  questionCount: number; // questions in the bank
  examLength: number; // questions per mock exam (all banks draw section-distributed samples)
  passPercent: number; // pass mark in whole percent (e.g. 74 = 74%)
  honoursPercent?: number; // optional second bar (CA Basic: 80% earns the Honours certificate)
  sections: string[]; // ordered section list
  bookCta: BookCta;
}

/** US Technician (2026–2030), parsed from NCVEC. */
export const US_TECH = usTechData as unknown as ExamQuestion[];
/** Canadian Basic (ISED), EN-only view of the bilingual rows. */
export const CA_BASIC = caBasicData as unknown as CaExamQuestion[];

/** Section list in first-appearance (syllabus) order, derived from the data itself. */
const sectionsOf = (questions: ExamQuestion[]): string[] => [
  ...new Set(questions.map((q) => q.section)),
];

/**
 * v1 shipped registry.
 *
 * Exam rules are the real published jurisdiction rules: US elements run 35
 * questions (Extra: 50) with a 74% pass mark; the CA Basic exam is 100
 * questions with a 70% pass mark, and ISED grants the Basic Honours
 * certificate at 80% or higher — so passPercent 70 / honoursPercent 80 for
 * ca-basic.
 *
 * CA Advanced's question bank is expected to be re-written by ISED in 2026;
 * a re-base is a pipeline re-run, not a registry change.
 */
export const BANKS: BankDefinition[] = [
  {
    id: 'us-tech',
    title: 'US Technician',
    subtitle: 'NCVEC Technician pool, 2026–2030 · 35-question exam, 74% to pass',
    questionCount: 409,
    examLength: 35,
    passPercent: 74,
    sections: sectionsOf(US_TECH),
    bookCta: { label: 'Read RadioBook 3', href: 'https://radiobook.ca/b3' },
  },
  {
    id: 'ca-basic',
    title: 'Canadian Basic',
    subtitle: 'ISED Basic question bank (re-based 2025-07-15) · 100-question exam, 70% to pass (80% Honours)',
    questionCount: 984,
    examLength: 100,
    passPercent: 70,
    honoursPercent: 80,
    sections: sectionsOf(CA_BASIC),
    bookCta: { label: 'Read RadioBook 3', href: 'https://radiobook.ca/b3' },
  },
];

/**
 * PARKED banks — parsed and validated but NOT bundled.
 *
 * The parsed JSONs stay on disk (src/data/banks/us-general.json,
 * us-extra.json, ca-advanced.json) where scripts/validate-pools.ts still
 * checks them offline against the raw pools; only their static imports were
 * dropped so the shipped entry chunk (and therefore the service-worker
 * precache) carries exclusively the SHIPPED banks' questions.
 *
 * Flipping one on at a later release is exactly two lines:
 *   1. one static import (e.g. `import usGeneralData from './banks/us-general.json';`)
 *   2. one BANKS entry copied from the table below.
 *
 * Their exam-rule data, kept as the flip-on source (exam rules are the real
 * published jurisdiction rules: US 35 questions at 74%; Extra 50 at 74%; the
 * CA Advanced bank is expected to be re-written by ISED in 2026 — a re-base
 * is a pipeline re-run, not a registry change):
 *
 *   us-general   : NCVEC General 2023–2027     · count 423 · 35 exam · 74%
 *   us-extra     : NCVEC Extra 2024–2028       · count 599 · 50 exam · 74%
 *   ca-advanced  : ISED Advanced bank          · count 549 · 50 exam · 70%
 */
