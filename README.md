# Tartanleaf Ham Exam Trainer

An offline-first, free and open-source study trainer for **US and Canadian
amateur radio license exams** — the US NCVEC pools (Technician, General,
Amateur Extra) and the ISED Canada Basic and Advanced banks.

Part of the **Tartanleaf** RadioBook series. No accounts, no analytics, no
network calls after the first install — install it, and study anywhere.

## Status

Work in progress — this repository is at the scaffolding stage. The study UI,
pool loading, and drills arrive in subsequent releases.

## Development

```bash
npm install
npm run dev       # dev server (app is served under /trainer/)
npm run validate  # typecheck + build + test
```

The app is a Vite + Lit + TypeScript PWA, served under the base path
`/trainer/`.

## Licensing

- Application code: MIT — see [LICENSE](LICENSE).
- US question-pool content: NCVEC public domain (Apache-2.0 packaging via
  russolsen/ham_radio_question_pool).
- Canadian question-pool content: Crown copyright (ISED), shipped verbatim.

Full third-party attribution is in [NOTICE](NOTICE) and
[data/raw/SOURCES.md](data/raw/SOURCES.md). Question pools are governed by
their original licenses; those terms do not extend to the application code.
