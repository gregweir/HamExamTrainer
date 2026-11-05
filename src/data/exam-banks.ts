// Bank registry — the single place every UI/progress task imports bank data from.
//
// The normalized question schema below is pinned by the design spec
// (docs/specs/2026-11-05-tartanleaf-ham-exam-trainer-design.md) and is produced
// byte-for-byte by scripts/parse-us.ts and scripts/parse-ca.ts.

import caBasicData from './banks/ca-basic.json';
import usTechData from './banks/us-tech.json';

/** Bank ids, mirroring the spec's union. */
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
  questionCount: number;
  passPercent: number; // pass mark in whole percent (e.g. 74 = 74%)
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
 * v1 shipped registry. US General/Extra and CA Advanced are parsed and emitted
 * under src/data/banks/ but are flipped into the registry by config in a later
 * release, per the plan's "Parked" list.
 *
 * Thresholds are the real jurisdiction rules: US Tech 35q/74% (35 questions at
 * 74%), CA Basic 100 questions / 70% pass with the 80% Honours bar (ISED grants
 * the Honours certificate at 80%+; see the task report's spec-note on the
 * design doc's inverted pass/honours wording).
 */
export const BANKS: BankDefinition[] = [
  {
    id: 'us-tech',
    title: 'US Technician',
    subtitle: 'NCVEC Technician pool, 2026–2030 · 35-question exam, 74% to pass',
    questionCount: 409,
    passPercent: 74,
    sections: sectionsOf(US_TECH),
    bookCta: { label: 'Read RadioBook 3', href: 'https://radiobook.ca/b3' },
  },
  {
    id: 'ca-basic',
    title: 'Canadian Basic',
    subtitle: 'ISED Basic question bank (re-based 2025-07-15) · 100-question exam, 70% to pass (80% Honours)',
    questionCount: 984,
    passPercent: 70,
    sections: sectionsOf(CA_BASIC),
    bookCta: { label: 'Read RadioBook 3', href: 'https://radiobook.ca/b3' },
  },
];
