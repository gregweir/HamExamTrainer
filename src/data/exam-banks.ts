// Bank registry — the single place every UI/progress task imports bank data from.
//
// The normalized question schema below is pinned by the design spec
// (docs/specs/2026-11-05-tartanleaf-ham-exam-trainer-design.md) and is produced
// byte-for-byte by scripts/parse-us.ts and scripts/parse-ca.ts.

import caAdvancedData from './banks/ca-advanced.json';
import blockNamesCa from './section-names-ca.json';
import caBasicData from './banks/ca-basic.json';
import usExtraData from './banks/us-extra.json';
import usGeneralData from './banks/us-general.json';
import usTechData from './banks/us-tech.json';
import syllabus from './us-tech-syllabus.json';

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
/** US General (2023–2027), parsed from NCVEC. */
export const US_GENERAL = usGeneralData as unknown as ExamQuestion[];
/** US Extra (2024–2028), parsed from NCVEC. */
export const US_EXTRA = usExtraData as unknown as ExamQuestion[];
/** Canadian Advanced (ISED), EN-only view of the bilingual rows. */
export const CA_ADVANCED = caAdvancedData as unknown as CaExamQuestion[];

/** Section list in first-appearance (syllabus) order, from the data. */
const sectionsOf = (questions: ExamQuestion[]): string[] => [
  ...new Set(questions.map((q) => q.section)),
];

/** The official NCVEC syllabus names (public domain); US banks only. */
const usTechGroups = (syllabus as { groups: Record<string, string>; subelements: Record<string, string> });
/** Subject-block titles for the ISED banks (derived from the questions as UI metadata; the bank text itself ships verbatim). */
const caBlockNames = (blockNamesCa as { 'ca-basic': Record<string, string>; 'ca-advanced': Record<string, string> });

/** The ISED exam structure: one question is drawn from each subsection on the real exam. */
export function bankBlock(bankId: ExamBankId, subsection: string): string | null {
  if (!bankId.startsWith('ca')) return null;
  return (caBlockNames[bankId === 'ca-basic' ? 'ca-basic' : 'ca-advanced'] as Record<string, string> | undefined)?.[subsection.slice(0, 5)] ?? null;
}
/** Group titles for US General/Extra come from their syllabi; CA advanced falls back to the group id. */
export function sectionTitle(bankId: ExamBankId, section: string): string {
  if (bankId.startsWith('us')) {
    return usTechGroups.groups[section] ?? section;
  }
  return section;
}

/** Subelement heading for a section (e.g. T1A → 'COMMISSION\'S RULES', G1A → 'COMMISSION'S RULES'). */
export function subelementTitle(bankId: ExamBankId, section: string): string | null {
  if (!bankId.startsWith('us')) return null;
  const sub = section.slice(0, 2);
  return usTechGroups.subelements[sub] ?? null;
}

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
/** CA Advanced's question bank is expected to be re-written by ISED in 2026; a re-base is a pipeline re-run, not a registry change. */
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
    id: 'us-general',
    title: 'US General',
    subtitle: 'NCVEC General pool, 2023–2027 · 35-question exam, 74% to pass',
    questionCount: 423,
    examLength: 35,
    passPercent: 74,
    sections: sectionsOf(US_GENERAL),
    bookCta: { label: 'Read RadioBook 2', href: 'https://radiobook.ca/b2' },
  },
  {
    id: 'us-extra',
    title: 'US Extra',
    subtitle: 'NCVEC Extra pool, 2024–2028 · 50-question exam, 74% to pass',
    questionCount: 599,
    examLength: 50,
    passPercent: 74,
    sections: sectionsOf(US_EXTRA),
    bookCta: { label: 'Read RadioBook 5', href: 'https://radiobook.ca/b5' },
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
  {
    id: 'ca-advanced',
    title: 'Canadian Advanced',
    subtitle: 'ISED Advanced question bank · 50-question exam, 70% to pass',
    questionCount: 549,
    examLength: 50,
    passPercent: 70,
    sections: sectionsOf(CA_ADVANCED),
    bookCta: { label: 'Read RadioBook 5', href: 'https://radiobook.ca/b5' },
  },
];
