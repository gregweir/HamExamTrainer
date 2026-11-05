# Public release checklist

Use the private operations runbook for access, transfer, publication, and
rollback. This public checklist intentionally contains no hosting details.

1. Run `npm run validate`.
2. Build the static bundle with `npm run build`.
3. Package `dist/` and verify its checksum.
4. Publish through the approved private process.
5. Confirm `https://radiobook.ca/trainer/` returns the current application.
6. Confirm a study selection survives reload and the installed PWA works
   offline.

Stop if validation fails or the private runbook is unavailable. Never guess or
record operational details in this repository.
