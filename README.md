# Tartanleaf Ham Exam Trainer

An offline-first, free and open-source study trainer for **US and Canadian
amateur radio license exams** — the US NCVEC pools (Technician, General,
Amateur Extra) and the ISED Canada Basic and Advanced banks.

Part of the **Tartanleaf** RadioBook series from **Smart Tech for Real
People**. No accounts, no analytics, no network calls after the first
install — install it, and study anywhere.

## Features

- **Chapter practice** — study any topic area (section) of a bank with the
  real question text, choices, figures and official references.
- **SM-2 spaced review** — questions you miss come back sooner, on the
  SuperMemo-2 schedule; the Review tab works your due queue.
- **Resumable practice exams** — the real pass rules, exactly: US elements
  run 35 questions (74% to pass), the CA Basic exam is 100 questions (70% to
  pass, 80% earns the ISED **Honours** certificate). Exams persist locally —
  leave mid-exam and resume any time. Unanswered questions grade as
  incorrect, just as they do at the real exam.
- **Written explanations, progressively** — questions carry hand-written
  explanations where the team has written them, marked by review status.
- **Progress that survives re-bases** — your record for each question keys
  on the question's content identity, not its pool id, so a pool re-base
  renumbering ids keeps your history.
- **Installable PWA** — offline at first install for both shipped banks:
  the app shell, question data and figures are precached by the service
  worker; offline navigations fall back to the app shell.

## Privacy and licensing

This is free and open-source software (MIT — see [LICENSE](LICENSE)), with
no ads, no accounts, and no analytics of any kind: all study progress lives
in your browser's local storage and never leaves your device.

Question-pool data is governed by its original terms:

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
