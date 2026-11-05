#!/usr/bin/env bash
# Deploy the built trainer bundle to an explicitly supplied target.
#
# Keep server, account, and path details outside this public repository.
# Usage: ./scripts/deploy-static.sh user@host:/approved/path
set -euo pipefail
TARGET="${1:?usage: deploy-static.sh user@host:/approved/path}"
cd "$(git rev-parse --show-toplevel)"
npm run build
rsync -avz --delete dist/ "$TARGET/"
echo "Published the build; verify https://radiobook.ca/trainer/ in a browser."
