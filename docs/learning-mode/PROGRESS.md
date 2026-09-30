# Learning mode: progress log

Checkpoints are appended here after every task, in the format described in
[PLAN.md §5](PLAN.md#5-checkpoints-and-look-back). Read this file and PLAN.md at
the start of every session.

## Current state

- Phase: **0 complete** (commit 3d89f43, full gate green). Waiting at the 🧑 gate for Yair to approve the spike
  findings below.
- Next task: 1.1 lesson types and validator.
- Branch: `claude/elegant-albattani-nifo57`.

## Decisions

| ID  | Decision                                                                                          | Date       | By   |
| --- | ------------------------------------------------------------------------------------------------- | ---------- | ---- |
| D1  | Continue building. Asking the upstream author stays a condition of public release (Phase 8 gate). | 2026-09-30 | Yair |
| D2  | open: settled per landmark in content review                                                      |            |      |
| D3  | Reviewer will be a medical student or resident; Yair is finding one. Name added when confirmed.   | 2026-09-30 | Yair |
| D4  | Yes: `@playwright/test` added for browser tests.                                                  | 2026-09-30 | Yair |
| D5  | open: settled per landmark in content review                                                      |            |      |

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
