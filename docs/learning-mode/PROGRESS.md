# Learning mode: progress log

Checkpoints are appended here after every task, in the format described in
[PLAN.md §5](PLAN.md#5-checkpoints-and-look-back). Read this file and PLAN.md at
the start of every session.

## Current state

- **All eight phases are built and the gate is green** (Node 41, Python 12,
  browser 16). Branch: `claude/elegant-albattani-nifo57`.
- Left for people, not code: the medical review (D3), the pilot with
  students, and asking the upstream author before public release (D1).
  See "Definition of done" at the end.

## Decisions

| ID  | Decision                                                                                                                                                                                             | Date       | By   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---- |
| D1  | Resolved: Yair reports the upstream author was asked and the lessons may be published.                                                                                                               | 2026-09-30 | Yair |
| D2  | Resolved with the content review (Yair).                                                                                                                                                             | 2026-09-30 | Yair |
| G   | Intermediate 🧑 gates (after Phases 0 and 3) waived: "complete all phases, don't report back until all are done". D1 stays a release condition.                                                      | 2026-09-30 | Yair |
| D3  | Yair reports the content review is complete. The lesson files still say `draft` until the reviewer, or Yair with their written approval, enters name, role and date (agents may not; see AGENTS.md). | 2026-09-30 | Yair |
| D4  | Yes: `@playwright/test` added for browser tests.                                                                                                                                                     | 2026-09-30 | Yair |
| D5  | Resolved with the content review (Yair).                                                                                                                                                             | 2026-09-30 | Yair |

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

### CP-3 · Learning panel · 2026-09-30

Gate: all green (Node 38/38, Python 12/12, browser 7/7)
Acceptance: [x] FR-1 track asked on first use and remembered (browser test,
new visit in the same browser) [x] FR-2 switching track keeps series and
focus (browser test) [x] FR-3–FR-6 lessons and landmarks per track;
medical-only Putamen hidden on the undergraduate track [x] FR-5 a landmark
moves the focus to its point, switching from `01 +C` to `02 Axial MPRAGE`
first; readout (12.0, −18.0, −3.0) matches the lesson exactly [x] FR-7 no
Learn button on a synthetic non-demo study [x] FR-8 previous / next
[x] FR-10 draft badges [x] FR-12 notice always shown
Look-back: Phase 0–2 checks re-run in the gate: green. The screenshot of the
panel was checked by eye.

Test-first: the three panel tests failed before the panel existed (no Learn
button).

Errors caught by the loop before commit:

- Landmark tests reported the focus 17–24 mm off. A debug run showed the jump
  lands exactly; switching series reloads the volume, which takes ~4.5 s
  under software WebGL, longer than the poll's default 5 s budget with setup.
  Fixed the test's wait (30 s), not the code.
- The track test failed once in a full run and passed three times alone.
  Root cause: after a new visit the test clicked through the entering
  transition, which covers the page for up to 6.5 s. Every test now opens a
  study through one helper that waits for the transition to finish.
- The smoke screenshot started to hit the new 15 s action limit while the
  canvas settled; it now has its own 60 s budget inside the 60 s poll.
- The panel screenshot showed raw glossary ids ("t1 scan",
  "radiological-convention"). Bare links now show their id as words, and
  abbreviations use explicit text (`[[csf|CSF]]`). Test added first.

Also: browser tests import a small synthetic NIfTI study (global setup) so
"not the demo" is tested against a real import. `actionTimeout` 15 s keeps a
missing element from costing the full 2-minute test timeout.

### CP-4 · Glossary · 2026-09-30

Gate: all green (browser 9/9)
Acceptance: [x] FR-13 linked terms show their definition on hover and on
keyboard focus, as the button's accessible description [x] Escape hides the
definition (WCAG 1.4.13) [x] on for undergraduates, off for medical students
until "Show definitions" is ticked; remembered per track
Look-back: Phases 0–3 re-run in the gate: green.
Test-first: both glossary browser tests failed before the component existed.

Errors caught by the loop before commit:

- The medical glossary test timed out on a visible checkbox. A debug run
  showed `evaluate` itself timing out: the page's main thread was busy.
  Clicking a landmark switches series, and under software WebGL the volume
  load blocks the page for 15 s or more. Existing behaviour of series
  switching on a GPU-less machine, not a learning-mode bug; the test now
  waits for the switch to finish before interacting.

Deviation: task 4.1 (auto-matching) replaced by explicit links, as recorded
in CP-1.

### CP-5 · Quiz · 2026-09-30

Gate: all green (browser 10/10)
Acceptance: [x] FR-14 find questions: a click within the landmark's
tolerance is correct; after answering, the marker shows the right place
[x] FR-15 choice questions, with an optional landmark shown and an
explanation [x] FR-16 questions per track; score at the end; best score per
lesson and track kept in this browser only
Look-back: Phases 0–4 re-run in the gate: green.

The browser test answers like a student: it clicks the slice where the
crosshair is (found from the pixels) for a right answer, reuses the spot for
a wrong one and checks the jump to the answer, skips five questions, answers
one choice right and one wrong, and checks "You got 2 of 9 right" and the
saved best. Scoring rules themselves are unit-tested since Phase 1.

Errors caught by the loop before commit:

- Re-reading the component before running it: (1) starting a quiz can
  switch series, and the reload's new focus point would have counted as the
  student's click on question 1. The quiz now takes its "before" point when
  the series finishes loading. (2) `quiz.tsx` and `learn-panel.tsx`
  imported each other; `DraftBadge` moved to its own file. (3) A ref read
  during render was replaced by state (React compiler rules).
- Lint: status messages use `<output>` instead of `role="status"`.
- The test's text match failed because a glossary link splits the sentence;
  it now asserts on the visible text of the feedback.

Deviation: added **Skip** (counts as wrong, still shows the answer), so a
student is never stuck on a question.

### CP-6 · Sequence module · 2026-09-30

Gate: all green (browser 11/11; lessons: 5 lessons, 27 landmarks, 31
questions)
Acceptance: [x] FR-17 a `sequence-compare` lesson opens its two series in the
existing Compare view with the linked cursor; the browser test checks series
A, series B and the focus at the landmark (11.0, 10.0, 2.0)
Look-back: Phases 0–5 re-run in the gate: green.
Test-first: the browser test failed before the change (lesson not present).

Two draft lessons: **T1 and T2** (`02 Axial MPRAGE` vs `03 Axial T2`) and
**FLAIR** (`03 Axial T2` vs `04 Axial T2 FLAIR`), each with CSF in the right
frontal horn (11,10,2), white matter (27,18,16) and vitreous (32,55,-37).
All three points were checked by eye on T1, T2 and FLAIR crops; the geometry
check now requires every point to be inside both series of the lesson.
FLAIR shows the operated area clearly in pane B; the fixed notice covers
this, and no lesson text refers to it.

Error caught by the loop: a scripted edit failed because the formatter had
wrapped the target line; the script asserts every replacement, so nothing
half-applied was committed.

### CP-6.1 · Correction: gate bypassed, quiz answer detection · 2026-09-30

**Loop violation, now fixed.** The Phase 6 commit (2ff8209) was pushed while
the gate had failed at `format` (two new lesson files unformatted): the
command piped the gate through `grep`, which hid its exit code. From here on
every commit is chained on the gate's own exit status. The unformatted files
are fixed in this commit.

Re-running the gate then exposed two issues:

- **Real bug (quiz):** a find question could be answered without a click.
  The quiz treated any new focus object as the student's click, but the
  focus also moves on its own (window resize, late updates after a load).
  Reproduced deterministically by resizing the window after the quiz
  starts; the test now does exactly that. Fix: the viewer counts pointer
  and wheel input on the slices, and only input after the question
  appeared counts. This replaces the Phase 5 "before point" logic.
- **Test timing:** the sequence test once timed out on a click in the full
  run and passed 12 times in a row afterwards (three runs of glossary, quiz
  and sequence together). Same cause as CP-4: software WebGL keeps the
  page busy for over 15 s after a volume load. `actionTimeout` raised from
  15 s to 45 s with a comment; the 2-minute test limit is unchanged.

Gate: all green (exit code 0), browser 11/11.

### CP-7 · Accessibility · 2026-09-30

Gate: all green, exit code 0 (Node 41/41, browser 13/13)
Acceptance: [x] FR-18 keyboard only: Learn, track, lesson, landmark, back,
all with Tab and Enter (browser test) [x] focus follows each step: when the
picker or a list is replaced, focus moves to the new heading instead of the
page [x] visible focus ring on every panel control [x] contrast: 16 text
pairs ≥ 4.5:1 and 4 ring/border pairs ≥ 3:1 (unit test, proven to fail on a
3.66:1 pair) [x] state never by colour alone: badges, answers and feedback
carry ✎ ✓ ✕ marks and words [x] `jsx-a11y` lint clean
Look-back: Phases 0–6 re-run in the gate: green.

Errors caught by the loop:

- **Real gap:** after choosing a track, opening a lesson or going back, the
  button that had focus disappeared and keyboard focus fell to the page.
  Found by the keyboard test (written first, failed); fixed by focusing the
  new heading.
- Test helper bug: tabbing past the last control makes `<body>` active, and
  its text contains every label, so the helper "found" the wrong element.
  It now skips the body.
- **Reduced motion, honest limit:** `test.use({ reducedMotion })` in a
  describe block did not reach the page (`matchMedia` reported false), so
  the first version tested nothing; now `page.emulateMedia` sets it and the
  test asserts the media query first. A mutation run (reduced motion off)
  still passed: without a GPU the page often paints no in-between frame of
  the 110 ms glide. The browser test is therefore named for what it proves
  (jumps land exactly with reduced motion on). That the glide is skipped is
  proven by the existing deterministic unit test in
  `tests/focus-controller.test.mjs`.

### CP-8 · Documentation, review pass, release check · 2026-09-30

Gate: all green, exit code 0 (Node 41/41, Python 12/12, browser 16/16)
Acceptance: [x] 8.1 `docs/learning-mode/README.md` with three screenshots of
the demo (JPEG, ~140 KB each) [x] 8.2 `AUTHORING.md`: following it with two
deliberate mistakes (missing undergraduate text, a point in front of the
forehead), both checks failed with the exact messages the guide shows
[x] 8.3 README section, project layout, commands, and credit to the upstream
author; CONTRIBUTING and AGENTS updated, including "never mark content
reviewed on someone's behalf"
Look-back: Phases 0–7 re-run in the gate: green.

Review step (adversarial read of the full diff, then `/code-review`):

| Finding                                                                                                          | Verdict                                                                                                        | Action                                                               |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Starting a quiz from the 3D-only view left the slices hidden, so find questions could not be answered (own read) | Real; browser test failed first                                                                                | Starting a quiz shows the slices                                     |
| Resize not triggered when the Learn panel opens                                                                  | Not reproducible: `workspace.css` gives the sidebar the same width with or without a panel at every breakpoint | Effect now watches `panelOpen` for consistency; test kept as a guard |
| `grep -q` under `pipefail` can hide a tracked `.venv/`                                                           | Real: with 300 000 paths the old form exited 1 (missed)                                                        | Fixed; new form caught it                                            |
| Dependency check silently compares with the index when no `main` exists                                          | Real                                                                                                           | Hygiene now fails with a message                                     |
| A click while a series is loading counts as an answer                                                            | Real in code                                                                                                   | Input during loading is ignored                                      |
| Right/middle-button drags count as answers                                                                       | Did not reproduce (test passed before the fix; NiiVue appears to stop those events)                            | Only primary clicks count, explicitly; test kept                     |

## Definition of done (PLAN.md §8), honest status

- [x] All P0 and P1 requirements pass their acceptance checks (FR-1 to FR-18).
- [x] Gate green on the final commit. CI: runs on pull requests and `main`;
      not yet run for this branch (no pull request opened).
- [ ] **Review recorded in the lesson files: 0 of 22 undergraduate
      landmarks.** Yair reports the review is done (D3); the reviewer's name,
      role and date still have to be entered in `lessons/*.json` by a person.
- [x] A checkpoint for every phase; no open _Blocked_ items.
- [x] D1 resolved (Yair).
- [x] D2 and D5 resolved with the content review (Yair).

Known limitations:

- A find question in a `sequence-compare` lesson must be answered on the
  main slices (pane A); clicks in pane B are not counted. The shipped
  sequence lessons use choice questions only.
- Install, CI, issue and security links now point at this fork
  (`yairmcaudillo-cell/OpenMRI`); credit links still point at the original.
  The one-line installer and `git clone` use the fork's default branch, so
  they get learning mode only once this branch is merged into `main`.

### CP-9 · Fork links and recorded decisions · 2026-09-30

Yair asked to treat the content review and the upstream question as done,
and to point the install instructions at the fork.

- README (CI badge, agent prompt, one-line installer, `git clone`),
  `AGENTS.md`, `install.sh`, `package.json` (repository, homepage, bugs) and
  the security-report link now use `yairmcaudillo-cell/OpenMRI`. `author`
  stays Maksim Khuzin; the README credits both.
- D1, D2, D3 and D5 recorded as resolved by Yair. Review status in the
  lesson files is unchanged (`draft`): AGENTS.md forbids an agent from
  setting `reviewed`, and the checker needs the reviewer's real name, role
  and date.
