# Tartanleaf Ham Exam Trainer — Implementation Plan (v1)



**Goal:** Ship v1 of the Tartanleaf Ham Exam Trainer — an offline-first FOSS PWA at `radiobook.ca/trainer/` covering US Technician + Canadian Basic (both study modes: chapter practice, SM-2 spaced review, resumable timed exams with real pass rules), Tartanleaf-branded with book/suite CTAs.

**Architecture:** Vite + Lit + TypeScript, same stack family as the suite. Data: a fetch/parse/validate pipeline (scripts/) emitting normalized JSON per bank from `data/raw/`. A small IndexedDB progress layer keyed by content-identity hashes + a per-pool-version id-alias map (re-base-proof). A `bank registry` module drives the UI (exam definitions carry counts/pass marks/sections). PWA: workbox-style precache of app shell + all shipped banks (JSON is small); figures lazy-but-cacheable.

**Tech Stack:** Vite 7 + Lit 3 + TS + vite-plugin-pwa; vitest + @open-wc/testing; Playwright for UI verification (use the established UI verification approach).

**Spec:** docs/specs/2026-11-05-tartanleaf-ham-exam-trainer-design.md (binding; implementation-review resolutions at the end are decisions).

## Global Constraints

- License MIT (LICENSE file from Task 1); Apache-2.0 NOTICE preserved beside reused figure assets; NCVEC + ISED attribution files accompany every shipped bank.
- CA bank text ships VERBATIM — never altered, in EN or FR; explanations only via separate annotation sidecars keyed by bank-scoped question id.
- No ads, no accounts, NO ANALYTICS in v1 (spec anti-goal); all computation local.
- Progress keys: content-identity (normalized text hash + section), alias map per pool version — never bare fragile ids (resolution 3).
- Exam thresholds EXACT: US Tech/General 35q/74%, US Extra 50q/74%; CA Basic 100q/80% (70% = Honours-eligible), CA Advanced 50q/70% (resolution 1).
- `npm run validate` = typecheck + build + vitest — green at the end of every task.
- Every task ends with its conventional commit; no attribution trailers.

## Review Focus

1. **Verbatim CA bank integrity** — no parser/normalize step may alter question/choice strings. Pinned: Task 2 test (round-trip: normalized output equals raw file content per question, byte-level after unescaping).
2. **Content-identity stability** — the same question under a re-based pool maps to the same progress key. Pinned: Task 3/4 test (identity = content hash; alias map test feeding two pool versions).
3. **Exam thresholds are exact, not hardocoded per-UI** — bank definitions carry counts/pass marks; the simulator computes from them. Pinned: Task 5 test (CA Basic 80/70 Honours, US 74%).
4. **SM-2 state machine purity** — scheduling math as a pure function; persistence layered. Pinned: Task 4 tests (due-date math, ease-factor bounds).
5. **Offline promise** — shipped banks + shell precached; the selected bank offline works first-run. Pinned: Task 8 PWA test/build check (precache manifest includes bank JSONs; figures lazy-cacheable).

---

### Task 1: Repo bootstrap — scaffold, license, brand tokens

**Files:**
- Create: `package.json` (Vite+Lit+TS+vite-plugin-pwa+vitest+@open-wc/testing; scripts: dev/build/test/validate; `base: '/trainer/'`)
- Create: `LICENSE` (MIT), `NOTICE` (Apache-2.0 attribution for russolsen figures), `README.md`
- Create: `vite.config.ts` (base `/trainer/`, pwa plugin, TS)
- Create: `src/main.ts`, `index.html` (title "Tartanleaf Ham Exam Trainer", tartanleaf favicon reference), `src/styles/tokens.css` (Tartanleaf palette from the suite's variables.css — copy the values: `--tl-cream #F4EFE5, --tl-sage #97A28A, --tl-coral #F58A6A, --tl-slate #255665, --tl-navy #173847, --tl-teal #2F5E5B, --tl-light-sage #C8D0C0, --tl-stone #EAE3D7` + dark-mode surfaces)
- Create: `src/assets/logo.svg` (copy Tartanleaf logo asset from the suite repo)

**Interfaces:** Produces the scaffold all tasks build on; the token system + logo asset.

- [ ] **Step 1: Implement** the scaffold (npm install, dev server runs, license/NOTICE/README with branding statement).
- [ ] **Step 2: Verify** `npm run validate` green; page loads with Tartanleaf title/colors.
- [ ] **Step 3: Commit** — `feat: scaffold vite+lit+ts pwa with tartanleaf tokens`

### Task 2: Pool pipeline — parse, normalize, validate

**Files:**
- Create: `scripts/fetch-pools.sh` (documents/curl the authoritative sources; stamps URL+date)
- Create: `scripts/parse-ca.ts` (semicolon TXT → normalized; EN+FR rows; section from id `B-001-002-001` → `B-001-002`)
- Create: `scripts/parse-us.ts` (russolsen JSON → normalized; figures dir mapping)
- Create: `scripts/validate-pools.ts` (counts vs official: US Tech 409 / General 423 / Extra 599; CA Basic 984 (EN rows); answer-index integrity; CA verbatim byte-check)
- Create: `src/data/exam-banks.ts` (registry: bank ids, titles, counts, thresholds, section lists, book-CTA mapping — Tech→Book 3, Basic→Book 3)
- Modify: `data/` (gitignored raw excluded from bundle; parsed output `src/data/banks/*.json`)

**Interfaces:**
- Produces: `interface ExamQuestion` exactly as the spec's schema; `BankDefinition { id, title, subtitle, questionCount, passPercent, sections, bookCta }`; `BANKS` registry consumed by all UI tasks.

- [ ] **Step 1: Write the failing tests** (`src/data/__tests__/pipeline.test.ts`, node-only, running the parsers as functions over `data/raw/`): CA verbatim round-trip (`question_id`→id, all 984 questions present, EN+FR texts byte-equal to raw after escaping), US counts + answers-in-range + `figure` resolves to an existing file for questions that declare one, answer-index bounds.
- [ ] **Step 2: RED** (parsers missing).
- [ ] **Step 3: Implement** the parsers + registry + emit JSON.
- [ ] **Step 4: GREEN + commit** — `feat: pool pipeline parsing NCVEC + ISED banks to normalized JSON`

### Task 3: Progress layer — IndexedDB + content-identity keys

**Files:**
- Create: `src/lib/ident.ts` (normalizeQuestionText, contentIdentity(bankId, section, normalizedText), simple hash)
- Create: `src/lib/id-aliases.ts` (per pool-version alias JSON → legacy-id → identity)
- Create: `src/lib/progress.ts` (IndexedDB via idb-keyval-like minimal wrapper: SM-2 records, exam history, settings)
- Test: `src/lib/__tests__/progress.test.ts` (fake-indexeddb)

**Interfaces:**
- Produces: `contentIdentity(string bank, string section, string text): string`; `ProgressStore`: `getRecord(identity)`, `recordAnswer(identity, correct, ts)`, `dueQueue(bank, limit, now)`, `saveExamSession(session)`, settings get/set.

- [ ] **Step 1: Failing tests** — identity stable across pool versions (same text+section+bank → same key; alias map bridges old ids), SM-2 record round-trip via fake-indexeddb, export/import JSON.
- [ ] **Step 2: RED → Step 3: implement → Step 4: GREEN → Step 5: Commit** — `feat: content-identity progress layer with re-base aliases`

### Task 4: SM-2 scheduler (pure)

**Files:**
- Create: `src/lib/sm2.ts`; Test: `src/lib/__tests__/sm2.test.ts`

**Interfaces:**
- Produces: `nextSchedule(record, quality: 0-5, now): { ease, intervalDays, dueAt }` — ease bounds 1.3–2.5, standard SM-2 intervals; pure, deterministic given (state, quality, now).

- [ ] **Step 1: Failing tests** (first-review interval, lapse → interval reset, ease bounds, ease increase/decrease math, due-date arithmetic).
- [ ] **Step 2: RED → implement → GREEN → Commit** — `feat: sm2 scheduling`

### Task 5: Study UI — chapter practice + question card

**Files:**
- Create: `src/components/exam-shell.ts` (top bar: logo, bank chooser, tabs: Practice/Review/Exam; dark tartanleaf theme)
- Create: `src/components/question-card.ts` (question text, optional figure, 4 choice buttons, instant feedback + explanation panel [shows draft watermark when explanationStatus=draft; references row], keyboard: 1-4 select, enter next)
- Create: `src/components/chapter-list.ts` (section list with per-section progress)
- Create: `src/components/book-cta.ts` (RadioBook link + License Ladder deep link per bank CTA config)
- Modify: `src/main.ts` (router-lite: /, /bank/:bankId, /practice)
- Tests: `src/components/__tests__/question-card.test.ts` (render, answer flow marks progress store, keyboard nav, figure renders when present; a11y: fixture-based axe-ish assertions consistent with suite patterns)

**Interfaces:** Consumes BANKS + ProgressStore; Produces the `<exam-shell>` PWA root.

- [ ] **Step 1: Failing tests** (question card render/answer/keyboard; shell renders bank list from registry; CTA links present).
- [ ] **Step 2: RED → implement → GREEN → browser check → Commit** — `feat: study ui - practice flow with question card`

### Task 6: Spaced review UI (due queue)

**Files:**
- Create: `src/components/review-session.ts` (due-question list → card flow with 1-5 quality grading [0-3 = again/hard/good/easy mapped to quality], session summary)
- Test: extend `question-card.test.ts` sibling file

**Interfaces:** Consumes sm2 + ProgressStore dueQueue; Produces review completion flows.

- [ ] **Step 1: Failing tests** (grading updates schedule; "nothing due" empty state; summary shows counts).
- [ ] **Step 2: RED → implement → GREEN → Commit** — `feat: spaced review session ui`

### Task 7: Exam simulator (resumable, exact rules)

**Files:**
- Create: `src/components/exam-session.ts` (start → seeded question sample honoring section distribution; timer elapsed + optional budget; resume after reload via ProgressStore; submit → verdict = percent vs bank.passPercent; per-section breakdown; Honours marker for CA Basic ≥80%)
- Test: extend progress tests (resume serialization) + a component test (verdict math: 25/35 = 71.4% → fail Tech; 80/100 CA → pass+Honours)

**Interfaces:** Consumes BANKS thresholds; ProgressStore exam session save/load.

- [ ] **Step 1: Failing tests** (sample respects counts + distribution; verdict math exact; resume restores answers).
- [ ] **Step 2: RED → implement → GREEN → browser check → Commit** — `feat: resumable exam simulator with exact jurisdiction rules`

### Task 8: PWA + deploy packaging

**Files:**
- Modify: `vite.config.ts` (vite-plugin-pwa config: precache app shell + bank JSONs; figures cache-first runtime cache)
- Create: `manifest.webmanifest` config (name "Tartanleaf Ham Exam Trainer", theme cream/navy, icons)
- Create: `scripts/deploy-static.sh` (publishes `dist/` to an explicitly supplied approved target; operational details remain private)
- Modify: `README.md` (release + deploy section)

**Interfaces:** Consumes: the public `/trainer/` hosting target; operational configuration remains private.

- [ ] **Step 1: Failing test** — build output contains the precache manifest with all bank JSONs listed (fs-based).
- [ ] **Step 2: RED → implement → GREEN (build) → Commit** — `feat: pwa precache + tartanleaf manifest + deploy script`
- [ ] **Step 3: Post-plan:** the explanation sidecars (drafts for US Tech + CA Basic) get authored progressively in `src/data/explanations/*.json` — separate commits, no re-review of code.

## Parked

- US General/Extra + CA Advanced/Honours/FR bank SHIPMENT (pipeline-ready; flipped on by config after v1 validates).
- Mobile store shells; native TUI.
- Production routing and operations documentation are maintained outside this repository.