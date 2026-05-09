#!/usr/bin/env bash
# Sync the upstream RETT calculator into this React app.
#
# What this does, in order:
#   1. cd into the sibling _original-source/ clone (created at first setup).
#   2. git fetch + fast-forward main from
#      https://github.com/jacobchandler111-svg/RETT.
#   3. rsync the calculator + UI subsystem folders from the upstream `js/`
#      tree into rett-react/public/legacy/js/, with --delete so removed
#      upstream files disappear locally too.
#   4. Copy data/taxBrackets.json and css/styles.css verbatim.
#   5. Print a summary of what changed.
#
# This script is idempotent. Run it any time you hear "the calculator was
# updated upstream" — no React-side code changes are needed for changes
# inside js/00-data .. js/05-projections. If the change is in js/04-ui you
# may need to add / remove a host <div> in src/components/pages/*.tsx; the
# diff at the end of this run will make that obvious.

set -euo pipefail

# --- Resolve paths --------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REACT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RETT_ROOT="$(cd "${REACT_ROOT}/.." && pwd)"
UPSTREAM_DIR="${RETT_ROOT}/_original-source"
UPSTREAM_REMOTE="https://github.com/jacobchandler111-svg/RETT.git"

cyan() { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }

# --- 1. Ensure upstream clone exists --------------------------------------
if [[ ! -d "${UPSTREAM_DIR}/.git" ]]; then
  cyan "==> Upstream clone not found at ${UPSTREAM_DIR}; cloning fresh."
  git clone "${UPSTREAM_REMOTE}" "${UPSTREAM_DIR}"
fi

# --- 2. Pull latest main --------------------------------------------------
cyan "==> Pulling latest from upstream main"
PREV_HEAD=$(git -C "${UPSTREAM_DIR}" rev-parse HEAD || echo none)
git -C "${UPSTREAM_DIR}" fetch --quiet origin
DEFAULT_BRANCH=$(git -C "${UPSTREAM_DIR}" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@' || echo main)
git -C "${UPSTREAM_DIR}" checkout --quiet "${DEFAULT_BRANCH}"
git -C "${UPSTREAM_DIR}" pull --quiet --ff-only origin "${DEFAULT_BRANCH}"
NEW_HEAD=$(git -C "${UPSTREAM_DIR}" rev-parse HEAD)

if [[ "${PREV_HEAD}" == "${NEW_HEAD}" ]]; then
  yellow "==> Upstream is already at ${NEW_HEAD:0:8}; no new commits."
else
  green "==> Upstream advanced from ${PREV_HEAD:0:8} -> ${NEW_HEAD:0:8}"
  git -C "${UPSTREAM_DIR}" --no-pager log --oneline "${PREV_HEAD}..${NEW_HEAD}"
fi

# --- 3. Mirror calculator + UI JS -----------------------------------------
LEGACY_DEST="${REACT_ROOT}/public/legacy/js"
mkdir -p "${LEGACY_DEST}"

cyan "==> Mirroring js/ subsystems into public/legacy/js/"
for sub in 00-data 01-brooklyn 02-tax-engine 03-solver 04-ui 05-projections; do
  if [[ -d "${UPSTREAM_DIR}/js/${sub}" ]]; then
    rsync -a --delete --itemize-changes \
      "${UPSTREAM_DIR}/js/${sub}/" \
      "${LEGACY_DEST}/${sub}/" || true
  else
    yellow "    (skipped — upstream has no js/${sub})"
  fi
done

# --- 4. Mirror data + CSS + assets ----------------------------------------
cyan "==> Mirroring data/, css/, assets/"
mkdir -p "${REACT_ROOT}/public/data" "${REACT_ROOT}/public/legacy/css" "${REACT_ROOT}/public/assets"
cp -f "${UPSTREAM_DIR}/data/taxBrackets.json" "${REACT_ROOT}/public/data/taxBrackets.json"
cp -f "${UPSTREAM_DIR}/css/styles.css"        "${REACT_ROOT}/public/legacy/css/styles.css"
if compgen -G "${UPSTREAM_DIR}/assets/*" > /dev/null; then
  rsync -a "${UPSTREAM_DIR}/assets/" "${REACT_ROOT}/public/assets/"
fi

# --- 5. Diff hint ---------------------------------------------------------
cyan "==> Sync complete."
echo
echo "Upstream commit:    ${NEW_HEAD}"
echo "Local public/legacy is now in sync with upstream."
echo
echo "If the upstream change touched js/04-ui, scan src/components/pages/*.tsx"
echo "to confirm every host <div id=\"...\"> the renderers expect still exists."
echo "Look for renderer module patterns like:"
echo "    document.getElementById('...-host')"
echo "in the diff above and add the matching <div> if any are missing."
