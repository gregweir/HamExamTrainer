#!/usr/bin/env bash
# Fetch the authoritative exam pools into data/raw/ and stamp URL + fetch date.
#
# The repo already carries the fetched snapshots (commit "data: raw pool
# sources ..."); this script documents and re-runs the fetch for a pool update
# or the 2026 CA Advanced re-write. It NEVER rewrites the committed raw files'
# content in place beyond (re)creating the stamped files below — pipeline code
# parses whatever is under data/raw/ exactly as fetched.
#
# Usage:  bash scripts/fetch-pools.sh     (run from the repo root)
#
# After fetching: run `npm run pools` (parse + validate), review `git diff
# data/raw/`, and update data/raw/SOURCES.md's "fetched" date.

set -euo pipefail

DEST=data/raw
FETCH_LOG="$DEST/fetch-log.txt"
TODAY="$(date -u +%Y-%m-%d)"

# --- US pools (NCVEC public domain; russolsen JSON packaging, Apache-2.0) ----
US_URL="https://github.com/russolsen/ham_radio_question_pool/archive/refs/heads/main.tar.gz"

# --- Canada (ISED, Crown copyright — verbatim reproduction with attribution) --
CA_BASIC_URL="https://apc-cap.ic.gc.ca/datafiles/amat_basic_quest.zip"
CA_ADVANCED_URL="https://apc-cap.ic.gc.ca/datafiles/amat_adv_quest.zip"

{
  echo "Fetch stamp — ${TODAY} (UTC)"
  echo "  US:          ${US_URL}"
  echo "  CA Basic:    ${CA_BASIC_URL}"
  echo "  CA Advanced: ${CA_ADVANCED_URL}"
  echo "See data/raw/SOURCES.md for the license attribution per source."
} >"$FETCH_LOG"
echo "fetch-pools: stamped ${FETCH_LOG} for ${TODAY}"

if [ "${FETCH_POOLS:-0}" != "1" ]; then
  echo "fetch-pools: stamp updated only. Run with FETCH_POOLS=1 to download:"
  echo "  ${US_URL}      -> data/raw/us/"
  echo "  ${CA_BASIC_URL}    -> data/raw/ca/basic/"
  echo "  ${CA_ADVANCED_URL} -> data/raw/ca/advanced/"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "fetch-pools: downloading US pools (russolsen packaging)..."
curl -fsSL "$US_URL" -o "$TMP/us.tar.gz"
mkdir -p "$TMP/us"
tar -xzf "$TMP/us.tar.gz" -C "$TMP/us" --strip-components=1
for pool in technician-2026-2030 general-2023-2027 extra-2024-2028; do
  mkdir -p "$DEST/us/$pool"
  cp "$TMP/us/$pool/$pool".{json,csv,txt,yaml} "$DEST/us/$pool/" 2>/dev/null || {
    echo "fetch-pools: expected $pool files missing from the archive" >&2
    exit 1
  }
  cp "$TMP/us/$pool/"*.png "$DEST/us/$pool/" 2>/dev/null || true
done

fetch_ca() { # $1 = url, $2 = dest dir
  mkdir -p "$2"
  curl -fsSL "$1" -o "$TMP/ca.zip"
  unzip -o "$TMP/ca.zip" -d "$2" >/dev/null
}

echo "fetch-pools: downloading ISED banks..."
fetch_ca "$CA_BASIC_URL" "$DEST/ca/basic"
fetch_ca "$CA_ADVANCED_URL" "$DEST/ca/advanced"

echo "fetch-pools: done. Review git diff data/raw/ then run npm run pools."
