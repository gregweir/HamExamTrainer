# Public deployment overview

The trainer builds as a self-contained static bundle for the public
`/trainer/` base path. Operational hosting details, access procedures, and
deployment configuration are maintained outside this public repository.

## Build

```bash
npm run build
tar -czf trainer-dist.tar.gz -C dist .
```

Publish the resulting artifact using the approved private operations process.
Do not add server addresses, account names, private paths, credentials, or
hosting configuration to this repository.

## Verify the public service

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://radiobook.ca/trainer/  # 200
curl -s -o /dev/null -w '%{http_code}\n' https://radiobook.ca/trainer/cb  # 200
```

Also confirm the installed PWA reloads offline and receives the normal update
prompt after a new version is published.
