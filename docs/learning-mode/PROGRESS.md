# Learning mode: progress log

Checkpoints are appended here after every task, in the format described in
[PLAN.md §5](PLAN.md#5-checkpoints-and-look-back). Read this file and PLAN.md at
the start of every session.

## Current state

- Phase: **2 complete**. Yair approved Phase 0 and asked for all phases to be
  completed in one run, without stopping at the intermediate 🧑 gates.
- Next task: 3.1 remembered track.
- Branch: `claude/elegant-albattani-nifo57`.

## Decisions

| ID  | Decision                                                                                                                                        | Date       | By   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---- |
| D1  | Continue building. Asking the upstream author stays a condition of public release (Phase 8 gate).                                               | 2026-09-30 | Yair |
| D2  | open: settled per landmark in content review                                                                                                    |            |      |
| G   | Intermediate 🧑 gates (after Phases 0 and 3) waived: "complete all phases, don't report back until all are done". D1 stays a release condition. | 2026-09-30 | Yair |
| D3  | Reviewer will be a medical student or resident; Yair is finding one. Name added when confirmed.                                                 | 2026-09-30 | Yair |
| D4  | Yes: `@playwright/test` added for browser tests.                                                                                                | 2026-09-30 | Yair |
| D5  | open: settled per landmark in content review                                                                                                    |            |      |

## Blocked

None.

## Dependency changes

- `@playwright/test` 1.56.1 (dev, pinned exactly). Why: the learning panel
  drives WebGL views, and only a real browser can check that a landmark jump
  moves the slices and that the 3D view renders. Node unit tests cannot load
  NiiVue. 1.56.1 matches the Chromium revision (1194) preinstalled in the
  cloud container; CI installs its own Chromium.

## Checkpoints

### CP-plan · PRD and plan written · 2026-09-30

Commit: 9aea349
Gate: not run (documentation only; no code changed)
Deviations from plan: none
Open issues: D1 to D5 open; plan awaits approval.

### CP-0.1 · Baseline on untouched code · 2026-09-30

Commit: 9aea349 (no code changes yet)
Gate: format ✓ · lint ✓ · typecheck ✓ · Node tests 25/25 ✓ · Python tests 9/9
✓ (Python 3.12.3) · build ✓
Acceptance: [x] every existing check passes before any change
Deviations from plan: none

### CP-0.2 · Gate script · 2026-09-30

Added `scripts/gate.sh` and `npm run gate` (`--fast` skips build and browser
tests).
Proven to fail on purpose: a badly formatted file stops it at `format`; an
added dependency with no note here stops it at `hygiene`.
Acceptance: [x] runs every step in order [x] stops at the first failure
[x] hygiene catches undocumented dependencies

### CP-0.3 · Spike: demo geometry · 2026-09-30

Imported the demo into a throwaway data directory (never `.openmri/`).

- `studies.source_hash` equals the SHA-256 in `demo/README.md`
  (`247b778c…3124`). Demo detection by hash works.
- `originalSeriesDescription` is the file stem, e.g. `02 Axial MPRAGE`, for
  all 18 series. Binding lessons by description works.
- Series ids are deterministic for the same archive (`02 Axial MPRAGE` is
  `6016bd1c…`), but lessons bind by description, as planned.
- Rigid registration of other series onto `02 Axial MPRAGE`, displacement at
  five probe points: Axial T2 FLAIR max 2.4 mm, Cor T2 FLAIR 1.1, Sag T2 1.1,
  Sag T1 1.2, Axial T1 1.8. **Shared scanner coordinates hold within 2.4 mm.**
  Consequence: quiz `toleranceMm` must be at least 3 mm; landmarks are placed
  on `02 Axial MPRAGE` (1 mm voxels).
- The viewer opens `01 +C Axial MPRAGE` by default. Selecting a landmark
  must switch to the lesson's reference series (task 3.4 already plans this).

### CP-0.4 · Spike: browser tests · 2026-09-30

- Headless Chromium 141 with SwiftShader renders the WebGL 2 volume.
  Screenshot checked by eye: head in 3D, three slices, focus mm readout.
- `playwright.config.ts` runs its own server on port **4174** with the data
  directory `.e2e-data/` (gitignored), so tests never touch the user's library
  or a server on 4173. `scripts/demo.mjs` takes `OPENMRI_PORT` for this; the
  host stays `127.0.0.1`.
- The pixel check decodes the screenshot in the page and counts lit pixels.
  A test proves it reports a black element as 0, so it cannot pass blindly.
  (The first version compared compressed PNG bytes, which would not catch a
  black canvas; replaced before commit.)
- CI: new `browser` job (setup, build, install Chromium, `npm run test:e2e`).
  Acceptance: [x] demo opens [x] 3D view renders [x] check rejects blank output

### CP-0.5 · Spike: driving the focus from a panel · 2026-09-30

- `viewer.tsx` already keeps the `FocusController` in state and passes it to
  `ComparePane` as a prop. The learning panel will receive it the same way.
- Same series: `focus.moveToWorld(mm)` moves all panes; covered by existing
  unit tests (`tests/focus-controller.test.mjs`, world-coordinate tests).
- Other series: the viewer already carries `worldPoint` across a series
  switch and re-centres on it after load. Task 3.4 sets that point to the
  landmark and switches series, instead of writing new navigation.
- Readout for tests: the viewer footer shows the focus in mm (`X … Y … Z …`).

Deviations from plan: `tests/e2e/pixels.ts` added (helper), and a small change
to `scripts/demo.mjs` (port override), both needed for isolated browser tests.

### CP-1 · Content model, validator, draft lessons · 2026-09-30

Commit: see the Phase 1 commit on the branch
Gate: all green (format, lint, typecheck, Node 36/36, lessons, Python 12/12,
build, browser 2/2, hygiene)
Acceptance: [x] `npm run lessons:check` passes on the real lessons and fails on
every broken fixture (23 rule cases + CLI cases) [x] Python geometry test
passes on the real demo and rejects points in air / outside the volume /
unknown series [x] gate green

What was built:

- `lib/lessons.ts`: types, `validateLesson`, `validateGlossary`,
  `validateCatalog`, glossary markup parser, track filters, series lookup,
  find-answer scoring. Imports nothing, so Node runs it without a build.
- `lib/lesson-catalog.ts`: bundles every `lessons/*.json` with
  `import.meta.glob`; an author never edits code to add a lesson (NFR-6).
- `scripts/check-lessons.mjs` (`npm run lessons:check`, now part of `npm run
check`) and `scripts/check_lessons.py` + `tests/test_lessons.py` (geometry).
- `lessons/schema.md` for authors; `lessons/glossary.json` (26 draft terms).
- Three draft lessons, 21 landmarks, 28 questions, all `draft`.

Draft landmark placement (by Claude, on `02 Axial MPRAGE`, each checked by eye
in zoomed axial, coronal and sagittal crops; **the reviewer must confirm
every one**):

| Lesson            | Landmarks (RAS mm)                                                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lobes-and-surface | frontal (25,45,20) · parietal (35,-55,40) · temporal (50,-10,-20) · occipital (18,-85,10) · insula, med (40,0,4) · cerebellum (25,-62,-35) · eye (32,55,-37)                                                                                                                                   |
| deep-structures   | lateral ventricle frontal horn (11,10,2) · third ventricle (1,-12,-2) · fourth ventricle (1,-36,-29) · CC genu (1,25,5) · CC splenium, med (1,-33,7) · thalamus (12,-18,-3) · caudate head (17,10,4) · putamen, med (25,2,0) · internal capsule PLIC, med (20,-8,2) · hippocampus (28,-22,-18) |
| brainstem         | midbrain (1,-22,-14) · pons (1,-22,-30) · medulla (1,-34,-50) · pituitary, med (1,5,-32)                                                                                                                                                                                                       |

Undergraduate track: 16 landmarks. Medical track: all 21.
Operated area found on the FLAIR montage: patient's left, upper hemisphere,
roughly 5–50 mm above the ventricles. Lateral landmarks are all on the right;
midline ones sit below it. Left out on purpose: corpus callosum body (next to
the enlarged left ventricle) and optic chiasm (could not place it
confidently).

Errors caught by the loop before commit:

- Geometry check: the hole-filling loop moved mask axes twice, so a point
  above the scan passed and valid points failed. Caught by negative probes;
  fixed, and the probes are now tests.
- Lint: error messages could print `[object Object]` for non-string ids;
  fixed with a formatter.
- Validator tests were written after the code, so each was proven able to
  fail by three deliberate mutations (tolerance bound, inclusive distance,
  draft check); each mutation failed a test.

Deviations from plan:

- 21 draft landmarks instead of 3, so the panel and quiz can be tried
  properly. All are drafts; content ownership is unchanged.
- Glossary terms are marked explicitly in text (`[[csf]]`) instead of
  auto-matched (task 4.1). Explicit links can be validated and never
  underline a word by accident.
- Lessons gained a required `order` field (file names do not give teaching
  order).

### CP-2 · Demo detection and lesson helpers · 2026-09-30

Gate: all green (Node 38/38, Python 12/12, browser 3/3)
Acceptance: [x] demo study reports `demo: true` (browser test on the real
import) [x] another study, even one whose patient is named Jane, reports
`demo: false` (Node test) [x] the archive hash is never sent to the browser
[x] track helpers filter correctly (Phase 1 tests)
Look-back: Phase 0 smoke test and Phase 1 lesson and geometry checks re-run
in the gate: green.
Test-first: the two demo tests failed before the implementation, for the
right reason (function and constant missing).
Deviation: the hash lives in `lib/library.ts` as `DEMO_ARCHIVE_SHA256`, not in
a new `lib/demo.ts`. The tests load `library.ts` as a standalone module, which
cannot import a sibling file. Task 2.3 helpers were already built and tested
in Phase 1.
