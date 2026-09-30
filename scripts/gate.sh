#!/usr/bin/env bash
# Runs every check in order and stops at the first failure. Learning-mode work
# (docs/learning-mode/PLAN.md §4) does not move on until this passes.
#
#   scripts/gate.sh            all steps
#   scripts/gate.sh --fast     skip the build and the browser tests
#
# npm shortcut: npm run gate.
set -euo pipefail
cd "$(dirname "$0")/.."

FAST=0
[[ "${1:-}" == '--fast' ]] && FAST=1
has_script() { node -e "process.exit(require('./package.json').scripts['$1'] ? 0 : 1)"; }

step() {
  echo "── gate: $1"
  if ! "${@:2}"; then
    echo "✗ gate failed at: $1" >&2
    exit 1
  fi
}

step 'format' npm run -s format:check
step 'lint' npm run -s lint
step 'typecheck' npm run -s typecheck
step 'node tests' npm test --silent
if has_script lessons:check; then step 'lessons' npm run -s lessons:check; fi
step 'python tests' npm run -s test:import
if [[ $FAST == 0 ]]; then
  step 'build' npm run -s build
  if has_script test:e2e; then step 'browser tests' npm run -s test:e2e; fi
fi

hygiene() {
  # Medical data and the Python environment never get committed.
  # No grep -q: with pipefail, an early grep exit can fail git with SIGPIPE.
  if git ls-files --cached --others --exclude-standard | grep -E '^\.(openmri|neurospace|venv)/' >/dev/null; then
    echo 'The data directory or .venv is tracked or unignored.' >&2
    return 1
  fi
  # A new dependency needs a note in the progress log (CONTRIBUTING.md).
  local base
  base="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || true)"
  if [[ -z "$base" ]]; then
    echo 'No main branch to compare package.json with; fetch origin main first.' >&2
    return 1
  fi
  git show "$base:package.json" > .gate-base-package.json || return 1
  node -e "
    const fs = require('fs');
    const names = (p) => Object.keys({ ...p.dependencies, ...p.devDependencies });
    const before = new Set(names(JSON.parse(fs.readFileSync('.gate-base-package.json', 'utf8'))));
    const log = fs.existsSync('docs/learning-mode/PROGRESS.md')
      ? fs.readFileSync('docs/learning-mode/PROGRESS.md', 'utf8') : '';
    const missing = names(require('./package.json')).filter((n) => !before.has(n) && !log.includes('\`' + n + '\`'));
    if (missing.length) {
      console.error('New dependencies without a note in PROGRESS.md: ' + missing.join(', '));
      process.exit(1);
    }"
  local status=$?
  rm -f .gate-base-package.json
  return $status
}
step 'hygiene' hygiene

echo '✓ gate passed'
