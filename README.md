# Tartanleaf Ham Exam Trainer

An offline-first, free and open-source study trainer for **US and Canadian
amateur radio license exams** — the US NCVEC pools (Technician, General,
Amateur Extra) and the ISED Canada Basic and Advanced banks.

Part of the **Tartanleaf** RadioBook series from **Smart Tech for Real
People**. No accounts, no analytics, no ad networks — the only requests it
makes are to this site itself, for the app and its question banks (and the
periodic check for a newer app version once you're online again). Study
anywhere, including offline once the app has loaded its assets.

## Practice, not the official exam

Everything here is **exam-style practice on the official question pools** —
the app is not an examination and does not grant any qualification. Licensing
exams are administered under the FCC (US) or ISED (Canada) with an accredited
examiner; the trainer reproduces the real exam structure and pass rules in a
simulation, and grades unanswered questions as incorrect the way the real
exams do.

## Question banks

All five banks ship in the app (per-bank provenance is under
[src/data/attribution/](src/data/attribution/), and the pipeline re-verifies
every count from `data/raw/` on each build):

| Bank | Pool / validity | Questions in the pool | Practice exam | Pass mark | Languages |
|---|---|---|---|---|---|
| US Technician (Element 2) | NCVEC 2026–2030 (effective 2026-07-01) | 409 | 35 questions | 74% | English |
| US General (Element 3) | NCVEC 2023–2027 (effective 2023-07-01) | 423 | 35 questions | 74% | English |
| US Amateur Extra (Element 4) | NCVEC 2024–2028 (effective 2024-07-01) | 599 | 50 questions | 74% | English |
| Canadian Basic | ISED bank re-based 2025-07-15 (984 questions) | 984 | 100 questions | 70% (80% earns the ISED **Honours** certificate) | English + French |
| Canadian Advanced | ISED bank (a re-write is expected in 2026) | 549 | 50 questions | 70% | English + French |

Counts and rules were verified against the NCVEC and ISED/RAC published
releases as of 2026-11-05. The NCVEC exams run in English; the ISED banks are
officially bilingual, and every Canadian question carries both the verbatim
English and French texts (same answer permutation). US elements do **not** all
run 35 questions — the Amateur Extra exam is 50 questions and the pool holds
599 of them. Canadian banks are expected to be re-based over time (ISED
advances an update to the Advanced bank); a re-base is a data-pipeline re-run
in this app, and your per-question record keys on each question's content
identity, not its id, so history survives renumbering.

## Features

- **Chapter practice** — study any topic area (section) of a bank with the
  real question text, choices, figures and official references.
- **SM-2 spaced review** — questions you miss come back sooner, on the
  SuperMemo-2 schedule; the Review tab works your due queue.
- **Resumable practice exams** — the real structure and pass rules: 35
  questions (74% to pass) for US Technician and General, 50 questions (74%)
  for US Amateur Extra, 100 questions (70% pass, 80% Honours) for Canadian
  Basic and 50 questions (70%) for Canadian Advanced. Exams persist locally —
  leave mid-exam and resume any time.
- **Bilingual interface and banks** — the UI switches between English and
  French, and the Canadian banks answer in the language you're studying in.
  NCVEC question text is available in English only (the official pool is
  English-only).
- **Installable PWA** — after the first load, the service worker precaches
  the app shell, every shipped bank's question data and all shipped figures,
  and offline navigations fall back to the app shell. Install it (iOS Safari:
  Share → Add to Home Screen; Android Chrome: "Install app") or just keep
  using it in the browser. Offline behaviour is the browser's standard
  service-worker flow — how far it carries you varies a little by device and
  browser, but once the assets are cached the app starts and studies with no
  connection.
- **Question schema carries an explanation slot** — each question can carry a
  hand-written, review-status-marked explanation keyed by question id. The
  annotation layer is not yet written: every question currently ships with
  `none`, so treat in-app hints as absent rather than complete.

## Privacy: where your data lives

There are no ads, accounts, or analytics of any kind.

- **Progress** (per-question SM-2 records, in-progress exams, submitted exam
  history) is stored in your browser's **IndexedDB**, on your device only.
- **Preferences** (interface language, light/dark theme, selected bank) live
  in the browser's **localStorage** on the same device.
- Nothing is transmitted to a server — there is no sync and no backend.

**If you clear your browser or site data**, all of the above goes with it:
the cached offline app and question banks are gone, and reopening
[radiobook.ca/trainer/](https://radiobook.ca/trainer/) online downloads the
app and its question banks again — but **cleared progress cannot be
recovered**. There is no server copy. Browsers can also evict storage under
pressure; treat your streak as device-local and precious.

## Licensing

This project's **application code** is free and open-source software under
the **MIT licence** — see [LICENSE](LICENSE).

The **question banks are governed by their own terms**, which are not the
MIT licence:

- **US pools (NCVEC)** — the question text and figures are public domain
  (National Conference of Volunteer Examiner Coordinators). The packaged
  JSON and figure files are used from
  [russolsen/ham_radio_question_pool](https://github.com/russolsen/ham_radio_question_pool),
  which is licensed under the Apache License, Version 2.0.
- **Canadian banks (ISED)** — Crown copyright, shipped verbatim (without
  alteration) as published by Innovation, Science and Economic Development
  Canada, by attribution: "Source: ISED, Amateur Radio question banks."

Full third-party attribution is in [NOTICE](NOTICE) and
[data/raw/SOURCES.md](data/raw/SOURCES.md); those pool terms do not extend
to the application code.

## Source and links

- Web app: **[radiobook.ca/trainer/](https://radiobook.ca/trainer/)**
- Source code: **[github.com/gregweir/HamExamTrainer](https://github.com/gregweir/HamExamTrainer)**

## Development

```bash
npm install
npm run dev       # dev server (the app is served under /trainer/)
npm run test      # vitest
npm run build     # production build → dist/
npm run validate  # typecheck + build + test
npm run pools     # re-parse the raw pools, then validate
```

The app is a Vite + Lit + TypeScript PWA, served under the base path
`/trainer/`. `scripts/validate-pools.ts` recomputes every bank from
`data/raw/` and fails loudly on any count, answer-key, verbatim-byte, or
content-identity inconsistency.

## Deploy

`npm run build` produces a fully static `dist/` bundle for the public
`/trainer/` path. Operational hosting and publication details are maintained
outside this repository. The live trainer is at
[radiobook.ca/trainer/](https://radiobook.ca/trainer/).
