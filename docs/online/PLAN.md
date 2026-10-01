# Online demo: plan and checkpoints

Goal: a public web page where anyone can try learning mode on the demo study,
without installing anything. Follows the loop, gate and stop rules of
[learning-mode/PLAN.md](../learning-mode/PLAN.md) §2–§5.

## What it is, and what it is not

The local app has no login and accepts uploads of medical scans, so it must
never be deployed (AGENTS.md, SECURITY.md). The online version is therefore a
**different build**, not the local server put online:

| Local app (unchanged)                 | Online demo                                           |
| ------------------------------------- | ----------------------------------------------------- |
| Node server on `127.0.0.1`, SQLite    | Static files only; no server code at all              |
| Import your own scans                 | No import. The only scan is the public demo study     |
| Library, patients, Focus over time    | One study (the demo); those features are not built in |
| Snapshots saved to the data directory | Snapshots download to the visitor's computer          |

Host: **GitHub Pages** from this repository, built by a GitHub Actions
workflow. The volumes are prepared in CI from `demo/jane-head-mri.zip` with
the same import pipeline as the app, so no generated scan files are committed.

## Guardrails

| Guardrail                                                           | Enforced by                                                                                                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The online page makes no request to `/api/` or to another origin    | Browser test records every request                                                                                                  |
| No upload or import is possible                                     | Browser test: no Import control, no file input                                                                                      |
| Only the demo study is published                                    | Data build reads only `demo/jane-head-mri.zip`; test checks the archive hash and every published volume's hash against the manifest |
| Content Security Policy limits connections to the page's own origin | `<meta>` CSP in `online/index.html`; browser test checks it                                                                         |
| The local app is unchanged when not built for online                | Existing gate: all 16 browser tests, Node and Python tests                                                                          |
| Published size stays reasonable                                     | Data build fails above 150 MB                                                                                                       |

## Phases

| #   | Task                                                                                                                                                        | Acceptance                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| O1  | `scripts/build_online_data.py`: import the demo into a temporary library, write `study.json`, `demo.json` and the 18 volumes                                | Test: hashes match the manifest, archive hash is the demo's, size budget                    |
| O2  | Online entry (`online/`), `vite.online.config.ts`, viewer `online` mode: static URLs, server-only controls hidden, snapshot download, Learn open on arrival | `npm run build:online` succeeds; local gate green                                           |
| O3  | Browser tests for the online build (`playwright.online.config.ts`)                                                                                          | Opens, landmark jump, quiz, compare, no `/api/` or foreign requests, no import, CSP present |
| O4  | `.github/workflows/pages.yml`, docs (`docs/online/README.md`), README, AGENTS and SECURITY clarified                                                        | Workflow valid; docs say what the online demo does and does not do                          |

## Checkpoints

Appended below after each phase.

### CP-O1 · Static data · 2026-09-30

`scripts/build_online_data.py` + `tests/test_online_data.py` (4 tests; failed
before the script existed). Publishes `demo.json`, `study.json` and 18
volumes, 62 MB. Checks: the archive is the demo (hash), every volume's hash
matches the manifest, no other files, no personal details, size budget.

### CP-O2 · Online build · 2026-09-30

`lib/online.ts` switches study and volume URLs at build time; the local app
is unchanged (`VITE_OPENMRI_ONLINE` unset). Online, the viewer hides Import,
Library, Focus over time and patient editing, labels itself "Online demo",
downloads snapshots instead of posting them, and opens Learn on arrival.
`online/index.html` carries a CSP limiting connections to the page's own
origin. Error caught: the build failed on `next/image` (used only by Focus
over time, not offered online); `online/next-image.tsx` stands in for it.
`online/` is now linted.

### CP-O3 · Online browser tests · 2026-09-30

`playwright.online.config.ts` serves `dist-online/` with `vite preview`.
Three tests: no import or server controls and CSP present; a full lesson
(landmark jump to 12, −18, −3 and the FLAIR comparison) with every request
on the site's own origin, none to `/api/`, and no CSP violations; a quiz and
a snapshot that downloads. Errors caught, all in the tests: the "Runs in
your browser" badge is hidden by the header's responsive CSS at 1440 px (as
"Runs locally" is in the app), so the test checks it is present; the
snapshot test must wait for the quiz's series to load; the snapshot button's
accessible name is "Save a PNG snapshot", not "Snapshot".

### CP-O4 · Deployment and docs · 2026-09-30

`.github/workflows/pages.yml` builds and publishes on push to `main` or by
hand (configure-pages v6, upload-pages-artifact v5, deploy-pages v5: the
latest majors, checked with `git ls-remote`). CI gained an `online` job; the
gate runs the online build and tests. `docs/online/README.md`, README,
AGENTS.md and SECURITY.md say what the online demo is and that the local
server is still never deployed.

Needs the maintainer: merge into `main`, then Settings → Pages → Source:
GitHub Actions.
