# Learning mode: execution plan

This is the plan Claude Code follows to build learning mode as specified in
[PRD.md](PRD.md). Progress is recorded in [PROGRESS.md](PROGRESS.md). Cloud
sessions are temporary, so these two files are the working memory: every
session starts by reading them and ends by updating PROGRESS.md.

## 1. Architecture in one page

```
lessons/                       content, no code
  schema.md                      field reference for authors
  glossary.json                  shared terms and definitions
  brain-basics.json              first lesson (undergrad + med)
lib/
  lessons.ts                     types, validator, pure helpers:
                                 track filtering, glossary matching, quiz scoring
  demo.ts                        DEMO_ARCHIVE_SHA256 and isDemoStudy()
app/
  learn/
    learn-panel.tsx              track picker, lesson list, landmark list, notice
    glossary-text.tsx            text with glossary terms as accessible tooltips
    quiz.tsx                     find-it and multiple-choice questions
    track.ts                     remembered track (localStorage, try/catch)
  viewer.tsx                     small change: a "Learn" toggle that mounts the
                                 panel and hands it the FocusController
  api/library/route.ts           small change: studies carry `demo: boolean`
scripts/
  check_lessons.py               geometry check: points inside the reference
                                 volume and not in background, on the real demo
  gate.sh                        runs the full gate in order, stops on first failure
tests/
  lessons.test.mjs               validator and helper unit tests (Node)
  test_lessons.py                Python geometry test on the demo archive
  e2e/learning.spec.ts           browser test: demo → Learn → jump → quiz (Phase 0 decides)
```

Key design decisions, each checked in Phase 0 before code depends on it:

- **Coordinates are physical RAS millimetres** on the reference series
  (`02 Axial MPRAGE`). The import keeps world geometry (`as_closest_canonical`
  reorients the voxel grid but not the world), and all 18 demo series share
  scanner coordinates, so a landmark lands in the same physical spot in every
  series. The jump uses the existing `FocusController.moveToWorld(mm)`.
- **Series are bound by description** (`originalSeriesDescription`), which for
  the demo is the NIfTI file stem, e.g. `02 Axial MPRAGE`. Human-readable and
  stable, unlike asset ids.
- **The demo is recognised by archive hash** (`studies.source_hash` equals the
  SHA-256 in `demo/README.md`), so a renamed Jane still works and a real
  patient called Jane never gets lessons.
- **Lessons are bundled at build time** (`resolveJsonModule`), so there is no
  new API route and no new server attack surface.
- **The new UI lives in `app/learn/`.** `viewer.tsx` (1,300 lines) gets the
  smallest possible hook, so the risk to existing features stays low.

## 2. The loop: how every task is done

Each task in the phases below goes through the same loop. No step is skipped,
and a task is not done until its checkpoint is written.

```
 ┌─────────────────────────────────────────────────────────────────┐
 │ 0. ORIENT   read PLAN.md, PROGRESS.md, the task's acceptance     │
 │             criteria; run the gate on HEAD (must be green)       │
 │ 1. SPEC     restate the task as testable criteria; list the      │
 │             files it may touch (the "blast radius")              │
 │ 2. TEST     write or extend the tests first; run them and see    │
 │             them FAIL for the right reason                       │
 │ 3. BUILD    smallest change that makes them pass                 │
 │ 4. VERIFY   run the gate (§4); on failure go to 3                │
 │ 5. REVIEW   re-read the diff adversarially against §3 guardrails │
 │             and the criteria; run /code-review on the diff       │
 │ 6. LOOK BACK re-run the acceptance checks of every EARLIER       │
 │             phase (regression sweep, §5)                         │
 │ 7. RECORD   commit, then append a checkpoint to PROGRESS.md      │
 │             with the commit hash and gate results; push          │
 └─────────────────────────────────────────────────────────────────┘
```

### Stop rules

- **Never proceed on red.** A failing gate is fixed before any new task.
- **Three strikes.** If the same gate step fails three fix attempts in a row,
  stop, write down what was tried in PROGRESS.md under _Blocked_, and ask Yair.
- **Scope breach.** If a change needs a file outside the task's blast radius,
  stop and re-plan the task (update this file) before touching it.
- **Surprise.** If something contradicts an assumption in §1 (for example,
  demo coordinates do not line up across series), stop, record it as a
  deviation, and revise the plan before continuing.
- **Human gates.** Phase boundaries marked 🧑 need Yair's approval before the
  next phase starts.

## 3. Guardrails

### Project rules (from AGENTS.md and CONTRIBUTING.md)

| Guardrail                                                   | Enforced by                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Server stays on `127.0.0.1`, no network calls, no telemetry | Review step; `grep` for `fetch(` to non-relative URLs in the gate  |
| No real medical data besides the demo                       | Review step; `git diff --stat` shows no new binary files           |
| `.openmri/` never committed                                 | Already in `.gitignore`; gate checks `git status` for it           |
| No detection, measurement, or diagnosis                     | Review step; lessons only store hand-placed points                 |
| Dependencies minimal and pinned                             | Gate fails if `package.json` changes without a note in PROGRESS.md |
| Commit messages explain why                                 | Review step                                                        |

### Learning-mode rules

| Guardrail                                                       | Enforced by                                               |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| Claude never sets `review.status` to `reviewed`                 | Validator requires reviewer name, role, date; review step |
| Placeholder text is marked `draft` and shows a badge in the app | Validator + e2e test                                      |
| Every declared track has text for every landmark                | Validator                                                 |
| Points lie inside the reference volume and not in background    | `scripts/check_lessons.py` on the real demo archive       |
| Lessons never mention the demo's post-surgical findings         | Review step; content checklist (§7)                       |
| Learning mode is invisible on non-demo studies                  | Unit test on `isDemoStudy`, e2e test                      |
| Viewer unchanged with learning mode off                         | Existing tests + e2e "learning off" case                  |

### Git safety

- Work only on `claude/elegant-albattani-nifo57`. No force-push, no history
  rewrite.
- One task, one or more small commits. Every phase end is a checkpoint commit.
- Undo is `git revert <hash>` of the recorded checkpoint commits, never
  `reset --hard` on pushed history.

## 4. The gate

`scripts/gate.sh` (created in Phase 0) runs these in order and stops at the
first failure:

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test` (Node unit tests, including lessons)
5. `npm run lessons:check` (from Phase 1)
6. `npm run test:import` (Python, including the demo import and lesson geometry)
7. `npm run build`
8. `npm run test:e2e` (from Phase 0/3, if D4 approved)
9. Hygiene: no `.openmri/` or `.venv/` staged, no new binaries, no
   `package.json` change without a PROGRESS.md note.

The gate result (pass, or the failing step with the first error line) goes
into every checkpoint.

## 5. Checkpoints and look-back

A checkpoint is an entry in PROGRESS.md:

```
### CP-<phase>.<n> · <task> · <date>
Commit: <hash>
Gate: all green | failed at <step>: <first error line>
Acceptance: [x] criterion 1  [x] criterion 2 ...
Look-back: phases 0..<n-1> re-checked: green | regressions: ...
Deviations from plan: none | ...
Open issues: none | ...
```

The look-back step re-runs the _acceptance checks_ of every completed phase,
not just the unit tests. Each phase below lists its acceptance checks as
commands or concrete manual steps so they can be repeated. If a look-back
finds a regression, it is fixed first, and recorded as its own checkpoint,
before the current task continues.

## 6. Phases

### Phase 0: baseline and spikes

Goal: prove the base is green and the design assumptions hold before building
on them.

| Task | What                                                                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1  | `npm ci`, `npm run setup`; run every existing check on untouched HEAD. Record the results as the baseline. If anything is red before our changes, record it and stop.                                                                                   |
| 0.2  | Create `scripts/gate.sh` (§4) and `npm run gate`.                                                                                                                                                                                                       |
| 0.3  | Spike (throwaway script, not committed): import the demo, confirm `originalSeriesDescription` values, confirm `source_hash` equals the README hash, confirm that one RAS point maps into the same anatomy in `02 Axial MPRAGE` and `04 Axial T2 FLAIR`. |
| 0.4  | Spike: headless Chromium from `/opt/pw-browsers` opens the app, loads the demo study, and WebGL 2 renders (screenshot not black). Decides whether e2e tests are feasible (D4).                                                                          |
| 0.5  | Spike: calling `moveToWorld` from outside the viewer moves all panes; confirm how the panel gets the controller.                                                                                                                                        |

Acceptance: baseline recorded; gate script runs green on HEAD; the three
spikes answered with evidence in PROGRESS.md; D4 decided.
🧑 **Gate:** Yair approves D4 and the spike findings.

### Phase 1: content model and validator

Goal: lessons exist as data and cannot be malformed.

| Task | What                                                                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | `lib/lessons.ts`: `Track`, `Lesson`, `Landmark`, `GlossaryEntry`, `Question` types; `validateLesson()` returning a list of readable errors.                                       |
| 1.2  | `lessons/schema.md`: every field, with an example, for authors.                                                                                                                   |
| 1.3  | `lessons/glossary.json` with a few placeholder terms, and `lessons/brain-basics.json` with 3 **draft** placeholder landmarks (points from the spike, text marked `TODO: author`). |
| 1.4  | `npm run lessons:check` (Node): schema, ids, per-track text, glossary references, review rules. Added to `npm run check`.                                                         |
| 1.5  | `scripts/check_lessons.py` + `tests/test_lessons.py`: on the real demo archive, each point is inside the reference volume and above a background threshold.                       |
| 1.6  | `tests/lessons.test.mjs`: a valid lesson passes; one broken fixture per rule fails with the expected message.                                                                     |

Acceptance: `npm run lessons:check` passes on the real lessons and fails on
every broken fixture; the Python geometry test passes; gate green.

### Phase 2: demo detection and lesson loading

| Task | What                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | `lib/demo.ts`: `DEMO_ARCHIVE_SHA256`; a test asserts it equals the SHA-256 of `demo/jane-head-mri.zip`.                      |
| 2.2  | `GET /api/library` adds `demo: boolean` per study (computed server-side; the hash itself is not sent).                       |
| 2.3  | `lib/lessons.ts` helpers: `lessonsFor(track)`, `landmarksFor(lesson, track)`, `resolveSeries(lesson, manifest)`. Unit tests. |

Acceptance: an imported demo shows `demo: true`; a synthetic NIfTI import
shows `demo: false`; helpers filter tracks correctly; gate green.

### Phase 3: learning panel (first usable version)

| Task | What                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1  | `app/learn/track.ts`: remembered track with the same try/catch storage pattern as `library-workspace.tsx`.                                       |
| 3.2  | `app/learn/learn-panel.tsx`: track picker on first use, lesson picker, landmark list, fixed notice (FR-12), draft badges (FR-10).                |
| 3.3  | `viewer.tsx`: a **Learn** button, visible only for demo studies, that opens the panel and passes the `FocusController`.                          |
| 3.4  | Selecting a landmark switches to the lesson's reference series if needed, then calls `moveToWorld`. Previous / next (FR-8).                      |
| 3.5  | e2e: demo → Learn → pick undergrad → click landmark → focus coordinates match the landmark (within 1 voxel); non-demo study has no Learn button. |

Acceptance: PRD stories U1 and A1 work end to end on the demo; FR-1 to FR-8,
FR-10 and FR-12 pass; learning mode off leaves the viewer unchanged; gate
green.
🧑 **Gate:** Yair tries it and approves before content work scales up.

### Phase 4: glossary

| Task | What                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | Pure matcher in `lib/lessons.ts`: finds glossary terms in text, whole words, case-insensitive, longest match first. Unit tests. |
| 4.2  | `app/learn/glossary-text.tsx`: accessible tooltip (hover and keyboard focus, `aria-describedby`). On for undergrad by default.  |

Acceptance: FR-13; keyboard-only user can read every definition; gate green.

### Phase 5: quiz

| Task | What                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5.1  | Question types in the schema and validator (find-it with `toleranceMm`, multiple choice), per-track.                                                   |
| 5.2  | Pure scoring: distance from click to landmark vs. tolerance; score totals. Unit tests including edge cases (exactly at tolerance, outside the volume). |
| 5.3  | `app/learn/quiz.tsx`: hides labels, reads the clicked point from `getWorldPoint()`, gives feedback, jumps to the answer; best score in localStorage.   |
| 5.4  | e2e: answer one question right and one wrong.                                                                                                          |

Acceptance: FR-14 to FR-16; gate green.

### Phase 6: sequence module (P2)

| Task | What                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------- |
| 6.1  | Lesson type `sequence-compare` naming two demo series; opens them with the existing compare pane. |
| 6.2  | Draft T1 vs. T2 vs. FLAIR lesson with per-track placeholder text.                                 |

Acceptance: FR-17; gate green.

### Phase 7: accessibility and polish

| Task | What                                                                                    |
| ---- | --------------------------------------------------------------------------------------- |
| 7.1  | Keyboard walk-through of the whole learning mode; fix focus order and visible focus.    |
| 7.2  | Contrast check of markers, badges, tooltips (WCAG AA); never colour alone.              |
| 7.3  | `prefers-reduced-motion` respected by landmark jumps (the controller already reads it). |

Acceptance: FR-18; `jsx-a11y` lint clean; gate green.

### Phase 8: documentation and release

| Task | What                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------- |
| 8.1  | `docs/learning-mode/README.md`: what it is, for whom, how to use it, screenshots from the demo. |
| 8.2  | Authoring guide: how to add a landmark, how review works, how to run the checks.                |
| 8.3  | README: learning-mode section, clear credit to upstream, and "Fork additions by Yair".          |

Acceptance: a new author adds a landmark following only the guide and the
checks catch a deliberate mistake; gate green.
🧑 **Gate:** release review with Yair; D1 resolved.

## 7. Content track (owned by Yair, runs alongside Phases 3–8)

Code and content are separate. Claude builds the engine and placeholder
drafts; people write and approve the medicine.

1. Choose the landmark list per track (start: 15 undergraduate, then medical).
2. Place each point on the demo: open the landmark in the app, adjust, copy the
   coordinates shown by the focus marker into the lesson file.
3. Write the text for each track. Keep undergraduate text to one or two
   sentences about location and function.
4. Run `npm run lessons:check`.
5. Reviewer checklist, per landmark:
   - [ ] The point sits on the named structure in all three planes.
   - [ ] The structure there looks typical; not in or next to the operated area.
   - [ ] Text is correct for each track and at the right level.
   - [ ] Nothing refers to this person's own findings.
   - [ ] Reviewer name, role, and date added; status set to `reviewed` by the
         reviewer or by Yair on their behalf.
6. Pilot with students; record results in `docs/learning-mode/pilot.md`
   without names or personal details.

## 8. Definition of done (v1)

- All P0 and P1 requirements pass their acceptance checks.
- The gate is green on the final commit, and CI is green.
- ≥ 15 undergraduate landmarks are `reviewed`; the rest are visibly drafts.
- PROGRESS.md has a checkpoint for every task, with no open _Blocked_ items.
- D1 to D5 are resolved and recorded.
