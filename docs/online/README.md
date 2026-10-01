# Online demo

Learning mode on the demo study, in the browser, with nothing to install:
**https://yairmcaudillo-cell.github.io/OpenMRI/** (live once GitHub Pages is
turned on, below).

It opens straight into learning mode: pick undergraduate or medical student,
work through the lessons, take the quizzes, compare T1, T2 and FLAIR.

## What it is and is not

- **A static website.** HTML, JavaScript and the prepared demo volumes. No
  server code runs; there is nothing to log in to and nothing to upload to.
- **Only the demo study.** The one scan is `demo/jane-head-mri.zip`, published
  with the consent of the person scanned. There is no import: visitors cannot
  open their own scans here. For that, install the local app.
- **Nothing leaves the visitor's browser.** Quiz scores and preferences stay in
  the browser's storage; snapshots download to the visitor's computer. A
  Content Security Policy lets the page connect only to its own site, and a
  browser test checks that every request stays there.
- **Not the local app online.** The local app accepts medical scans and has no
  login, so it is never deployed (see SECURITY.md).

## Turn it on (once)

1. Merge the learning-mode branch into `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
3. The **Online demo** workflow (`.github/workflows/pages.yml`) runs on every
   push to `main`, or by hand from the Actions tab. It prepares the volumes
   from the demo archive with the app's own import pipeline, builds the page,
   and publishes it. The address appears in the workflow run.

## Try it on your computer first

```sh
npm ci && npm run setup          # once
npm run build:online             # prepares data/ and builds dist-online/
npm run preview:online           # http://127.0.0.1:4175/OpenMRI/
npm run test:online              # the online browser tests
```

`npm run gate` runs the online build and its tests together with every
other check.

## How it is built

`scripts/build_online_data.py` imports the demo into a temporary library and
publishes only `demo.json`, `study.json` and the 18 prepared volumes (about
62 MB; the build fails above 150 MB). `vite.online.config.ts` builds
`online/main.tsx`, which renders the same viewer with `lib/online.ts` pointing
it at those files instead of the local API. Server-only controls (Import,
Library, Focus over time, editing the patient) are not shown. The plan and its
checkpoints are in [PLAN.md](PLAN.md).
