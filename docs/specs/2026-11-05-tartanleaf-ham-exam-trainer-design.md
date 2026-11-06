# Tartanleaf Ham Exam Trainer — Design (v1)

**Status:** Owner-approved; implementation review complete.
**Repo:** standalone public repository.
**Date:** 2026-11-05.

## Intent

A free, open-source, offline-first ham-radio exam trainer covering **United States
(all classes: Technician, General, Extra)** and **Canada (Basic, Basic Honours,
Advanced)** — the market incumbents either skip Canada entirely, are closed/forked
into walled products, or are stale. Built by the RadioBook team: the trainer
promotes the RadioBook book series and radiobook.ca without gates (everything
FOSS; books are reading suggestions, never paywalls).

Name: **Tartanleaf Ham Exam Trainer** — Tartanleaf logo/brand/colors throughout;
the descriptive part tells newcomers what it is; no unfamiliar in-jokes as the
brand (research rejected "Five by Nine" for beginner-hostility).

## Demand basis (researched 2026-11-03/05)

- Ham Radio Prep: 100k+ installs, 4.6★ — proven demand; monetized/freemium incumbents with resented Paywalls.
- Weakest OSS field: stale-pools HAMtrainer, account-walled Open Ham Prep, no current-Canadian-pool app anywhere.
- Canadian bank re-based July 15, 2025 — structural demand spike; no app ships it yet.

## v1 scope

**First release: US Technician + Canadian Basic** (the two biggest audiences),
with the other classes shipping through the same data pipeline right after
(US General/Extra; CA Advanced + Honours + Basic French — the code is
exam-agnostic from day one).

### Study model (v1 = both)

1. **Chapter practice** — pick a topic area, answer questions, immediate
   feedback (correct/incorrect + explanation).
2. **Spaced review** — SM-2 style scheduling: missed and aging questions
   resurface; a per-question stability field drives "what's due today".
3. **Timed practice exams** — the REAL exam rules per element: US = 35 questions,
   74% pass (Tech/General), Extra 50 questions / 74%; CA Basic = 100 questions,
   70% pass (80% marks Honours eligibility), Advanced = 50 questions / 70%.
   The simulator shows the pass/fail verdict against those exact thresholds.

### Written explanations per question

The differentiator. Every question gets a plain-language explanation written by
the RadioBook team (the answer-key material is the seed corpus). Explanations
are **stored adjacent to** (not replacing) the official question text — Canada's
bank must ship verbatim (Crown copyright: non-commercial unaltered reproduction
is permitted with attribution; explanations are separate annotations tied by
question id, never edits to the bank text).

### Platform + posture

- **Web app, offline-first PWA** (installable, zero account, zero ads, no
  tracker, all computation local). Desktop-first responsive layout; mobile is
  the PWA-install case.
- Same stack family as the suite: Vite + Lit + TypeScript.
- Branding surfaces: Tartanleaf logo + palette; per-exam "reading" CTAs to the
  matching RadioBook book (plain links, no gates); "practice this in the game
  suite" deep-links where a drill exists (License Ladder).
- Persistence: localStorage/IndexedDB only — progress belongs to the user's
  browser (and future export/import for device moves).

## Data pipeline (legal structure per research)

| Bank | Authoritative source | License status | Shipping rule |
|---|---|---|---|
| US Tech/Gen/Extra | ncvec.org releases (public domain; PDF/DOCX/TXT + figure images) | public domain (NCVEC statement) | Ship parsed JSON + extracted figure PNGs; attribution note to ncvec.org |
| CA Basic / Advanced (+ FR) | ISED apc-cap.ic.gc.ca `amat_basic_quest.zip` / `amat_adv_quest.zip` (delimited TXT, EN + FR files) | Crown copyright: verbatim non-commercial redistribution with attribution permitted; **no alteration** of question/choice text | Ship verbatim + `reproduced from <ISED URL>` attribution; explanations as separate annotation layer keyed by question id |
| Cross-check | github.com/russolsen/ham_radio_question_pool (Apache-2.0 incl. packaging; NCVEC text public domain; figure PNGs included) | Apache-2.0 | Parse/validate reference; ship our own parsed data, keep the license notice where its figures are reused |
| Avoid | github.com/simonw/* (no license), ExHAMiner/SignalPrep data (freeware/closed, unlicensed) | — | Do not reuse |

**Pipeline scripts** (repo `scripts/`): fetch → parse → normalize to one
internal schema → validate (counts vs official totals, answer-key integrity)
→ emit `src/data/<bank>.json` + `figures/`. Versioned + dated; the CA Advanced
bank swap (2026) must be a re-run, not a code change.

**Internal question schema (normalized):**

```ts
interface ExamQuestion {
  id: string;              // bank-scoped stable id (e.g. "T1A01-2026", "CA-B-0042")
  bank: ExamBankId;        // 'us-tech' | 'us-general' | 'us-extra' | 'ca-basic' | 'ca-basic-honours' | 'ca-advanced'
  section: string;         // syllabus/section id e.g. "T1A"; CA section codes
  question: string;
  choices: string[];       // full texts, in presented order
  correctIndex: number;
  figure?: string;         // figures/<bank>/T-1.png etc.
  references: string[];    // official reference codes
  explanation?: string;    // written by RadioBook team; optional until authored
  explanationStatus: 'none' | 'draft' | 'reviewed';
}
```

**Honours = Basic bank + the higher Honours bar (80%)** — a rendering rule, not a
separate bank. Bilingual: CA Basic EN bank v1; the FR bank ships through the
same pipeline (same ids, French text) — v1 includes it if the parse is clean.

## Non-goals (v1)

- Mobile app stores (the PWA covers phones; native shells are a later call).
- LoTW/eQSL/logbook features; session sync; accounts.
- The game suite's drills — deep links only.
- Suite-wide branding changes.

## Anti-goals

- Never alter Canadian bank text (including "improving" it) — attribution +
  verbatim or nothing.
- No ads, no analytics beyond a privacy-respecting opt-in like the suite's
  (NOT in v1 — ship with none), no accounts, no gates anywhere.

## Acceptance criteria

- All shipped banks validate against official question counts and answer keys.
- Practice / spaced review / exam modes work fully offline (service worker).
- Exam simulator enforces the exact pass thresholds above and shows verdicts.
- Progress survives reload (IndexedDB), with export/import later.
- Tartanleaf branding + book CTAs render on every study screen.
- `npm run validate`-equivalent green: typecheck + build + unit tests + a11y.

## Implementation details

- Exact SM-2 variant/parameters and IndexedDB storage shape.
- The pool parsers' internals (per-source quirks; CA TXT delim format).
- UI layout/typography within the Tartanleaf token system.
- The explanation-authoring workflow (a JSON/MD sidecar per bank + a review
  checklist; `explanationStatus` governs display).

## Risks

- CA bank format quirks (delimited TXT); figures only exist in the US pools
  (ca banks figure-free per the research).
- A 2026 CA Advanced bank swap — pipeline must re-run cleanly.
- Pool updates (erratas) — the fetch script must stamp its source URL + date.

## Implementation-review resolutions (2026-11-05)

1. **Exam-mode rules:** exam-like — no per-question feedback during a
   mock exam; verdict (pass/fail + per-section breakdown) at the end; timer
   optional (the operator sets it; US exams have no official limit, CA time is
   invigilator-set — the timer shows elapsed and optionally a soft budget);
   exams are **resumable** (state persisted locally).
2. **Explanations launch bar (decision recorded 2026-11-05): "progressive drafts"** —
   the feature ships day one; drafts for US Tech + CA Basic authored into the
   sidecars and rendered marked *draft*; the owner reviews drafts → `reviewed`.
   Other classes fill progressively. **French explanations: out of v1** — FR
   users see the EN annotation marked as EN.
3. **Progress keys survive re-bases:** user state keys on a stable
   content identity (`bank + section + normalized question text hash`), with an
   id-alias map generated per pool version — a 2026 CA Advanced swap or an NCVEC
   re-base migrates SM-2 state by content, never by fragile id alone.
4. **Hosting:** published at `radiobook.ca/trainer/`. Operational hosting, routing, and deployment details are maintained outside this repository.
5. **Offline: lazy per-bank precache** — first install: app shell +
   the selected bank (US Tech by default) fully precached *including figures*;
   other banks cache on first open. Every shipped bank remains offline-capable
   once opened.
6. **License: MIT** for the repo; Apache-2.0 NOTICE preserved for
   reused russolsen figure assets; NCVEC public-domain + ISED attribution files
   accompany the data.

## Implementation-review addendum (2026-11-05, pool pipeline stage)

- **Canadian pass rules CORRECTED:** Basic = 70% pass, 80% = Honours (an earlier
  wording inverted these; ISED rules as per the July 2025 bank documents).
- **Choice ORDER:** the ISED TXT always presents the correct answer first; the
  pipeline applies a deterministic, id-seeded permutation so the correct answer
  is not positionally identifiable, EN+FR permuted identically, all strings
  byte-preserved (round-trip test). Exam mode may reshuffle presentation per
  attempt.
- **Bundle/precache note:** banks are statically imported (inlined in JS
  chunks) — the PWA precaches built chunks; no separate raw-JSON precache copy
  is needed (Task 8's test asserts chunk precaching).
