# Learning mode: product requirements

Status: draft for approval · Owner: Yair (fork maintainer) · Engineering: Claude Code
Upstream project: [lev1nson/OpenMRI](https://github.com/lev1nson/OpenMRI) by
Maksim Khuzin, MIT license. Learning mode is an addition to that project, not a
replacement, and the upstream credit stays in place.

## 1. Problem

Students learn neuroanatomy from labelled 2D atlas drawings and a handful of
textbook slices. They rarely get to move freely through a real 3D MRI and see
how the structures they memorised sit in three planes at once. OpenMRI already
renders a real head MRI in 3D with three linked slices, but it has no teaching
content: nothing tells a student what they are looking at.

## 2. Goal

Turn OpenMRI into **one learning engine with two tracks**, so that a student
can open the demo study, pick their level, and learn and test themselves on
neuroanatomy and MRI basics, entirely offline and locally.

| Track             | Audience                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| **Undergraduate** | Intro neuroscience, psychology, anatomy & physiology, biomedical engineering students |
| **Medical**       | Preclinical medical students (neuroanatomy block, radiology elective)                 |

Both tracks share the scan, the engine, and the landmark positions. They
differ in which landmarks are shown, how deep the text goes, and which quiz
questions appear.

## 3. Non-goals

- **No diagnosis, detection, or measurement.** Nothing is computed from image
  intensities to find or size a structure. Every label is placed by a person.
- **No comments on the demo patient's own findings.** The demo scan shows a
  brain after surgery. Lessons teach general anatomy; they never describe,
  point at, or explain the post-surgical changes of the real person scanned.
- No lessons on users' own imported scans in v1. Lessons bind to the demo
  study only.
- No accounts, cloud sync, analytics, or telemetry. Quiz scores stay in the
  browser.
- No new real scans in the repository (upstream rule).
- The patient-facing "before your appointment" guide is out of scope for v1.

## 4. Users and stories

**U1, undergraduate.** "As a psychology student, I want to click
_Hippocampus_ and see where it is in all three planes and in 3D, with a
one-line explanation of what it does, so I can connect the structure to what
I learn in lectures."

**U2, undergraduate.** "When a term like _gyrus_ or _anterior_ confuses me, I
want a definition right where I read it."

**M1, medical student.** "I want more structures, anatomical detail and
general clinical relevance, and I want to test myself by finding a structure
on the slices without labels."

**M2, medical student.** "I want to see why the same tissue looks different on
T1, T2, and FLAIR, using the demo's own series side by side."

**A1, author (Yair or an instructor).** "I want to add or fix a lesson by
editing a JSON file, and have a check tell me immediately if I made a mistake
(bad coordinates, missing text for a track, unreviewed content)."

**R1, reviewer.** "I want to see exactly which landmarks I approved, and for
unreviewed content to be visibly marked as a draft in the app."

## 5. Functional requirements

Priority: **P0** = v1 must have, **P1** = v1 should have, **P2** = later.

### Track selection

- **FR-1 (P0).** On first use of learning mode, the app asks "Undergraduate or
  medical student?". The choice is remembered in the browser and can be
  changed at any time from the learning panel.
- **FR-2 (P0).** Switching track never reloads the volume or loses the current
  position.

### Lessons and landmarks

- **FR-3 (P0).** A lesson is a JSON file in `lessons/`. It has an id, a title
  per track, a list of the tracks it belongs to, the reference series it is
  placed on, and an ordered list of landmarks.
- **FR-4 (P0).** A landmark has an id, a name, a point in physical RAS
  millimetres on the reference series, the tracks it appears in, text per
  track, and a review status.
- **FR-5 (P0).** Selecting a landmark moves the focus marker to its point: the
  three slices and the 3D view jump there, using the existing focus
  controller.
- **FR-6 (P0).** On the undergraduate track, landmarks tagged only for the
  medical track are hidden, and the undergraduate text is shown.
- **FR-7 (P0).** Learning mode is offered only when the open study is the demo
  study, recognised by the SHA-256 of its source archive, not by the patient
  name.
- **FR-8 (P1).** Previous / next buttons step through a lesson in order.
- **FR-9 (P2).** Labels drawn as text inside the 3D view.

### Content safety

- **FR-10 (P0).** Every landmark carries `review.status`: `draft` or
  `reviewed`. A `reviewed` landmark must name the reviewer, their role, and the
  date. The app shows a visible **Draft, not reviewed** badge on draft
  content.
- **FR-11 (P0).** A validator (`npm run lessons:check`, part of `npm run
check`) rejects: malformed lessons, duplicate ids, missing text for a
  declared track, points outside the reference volume, points in air
  (background), unknown glossary terms, and `reviewed` without reviewer
  details.
- **FR-12 (P0).** Each lesson shows a fixed notice: "For learning general
  anatomy. This scan shows changes after surgery and is not a normal
  reference. Not medical advice."

### Glossary

- **FR-13 (P1).** A shared `lessons/glossary.json`. On the undergraduate track,
  glossary terms in landmark text are underlined and show their definition on
  hover and keyboard focus. The medical track can turn this on.

### Quiz

- **FR-14 (P1).** "Find it" questions: the app names a structure, labels are
  hidden, the student clicks a slice. The answer is correct if the clicked
  point lies within the landmark's tolerance radius (set by the author, in
  mm). After answering, the app jumps to the correct location.
- **FR-15 (P1).** Multiple-choice questions ("Which structure is at the
  marker?", "Which sequence is this?").
- **FR-16 (P1).** Questions list the tracks they belong to. A quiz shows a
  score at the end and stores the best score per lesson in the browser only.

### Sequence module

- **FR-17 (P2).** A lesson type that opens two demo series side by side with
  the existing compare pane (for example T1 MPRAGE and T2 FLAIR) with
  per-track explanations of why tissues look different.

### Accessibility

- **FR-18 (P0).** Everything in learning mode works by keyboard, has visible
  focus, and has screen-reader names. Marker and badge colours meet WCAG AA
  contrast and do not rely on colour alone.

## 6. Non-functional requirements

- **NFR-1.** Local only. No network calls; lessons are bundled with the app.
- **NFR-2.** No regression: `npm run check`, `npm run test:import`, `npm run
build`, and the demo CI job stay green after every change.
- **NFR-3.** Existing viewer behaviour is unchanged when learning mode is off.
- **NFR-4.** New dependencies need a written justification (CONTRIBUTING.md)
  and are pinned.
- **NFR-5.** Selecting a landmark updates the view within one animation of the
  existing focus transition; no visible lag on a 2020-era laptop.
- **NFR-6.** Content and code are separate: an author never edits TypeScript
  to add a lesson.

## 7. Success measures

| Measure                                                              | Target for v1                 |
| -------------------------------------------------------------------- | ----------------------------- |
| Undergraduate landmarks written and reviewed by a qualified reviewer | ≥ 15                          |
| Medical-track landmarks written and reviewed                         | ≥ 30                          |
| Students in the pilot                                                | ≥ 10 undergraduates           |
| Pilot: "helped me understand where structures are" (1–5 scale)       | median ≥ 4                    |
| Pilot: quiz score change, first attempt vs. after the lesson         | reported, whatever the result |
| Regressions in existing features                                     | 0                             |

## 8. Risks and open decisions

| ID  | Risk or decision                                                                                                                                                         | Owner           | Resolution needed by              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | --------------------------------- |
| D1  | `demo/README.md` says the scan is not for "any medical purpose". Teaching general anatomy on it is probably fine, but ask the upstream author before publishing lessons. | Yair            | Before public release             |
| D2  | The demo shows post-surgical changes. Landmarks must avoid the operated area; the reviewer confirms each point shows typical anatomy.                                    | Yair + reviewer | Content review                    |
| D3  | Who reviews the content (anatomy instructor, TA, resident)? Their name appears in the lesson files.                                                                      | Yair            | Before any landmark is `reviewed` |
| D4  | Browser end-to-end tests need `@playwright/test` as a dev dependency. Recommended; see PLAN.md Phase 0.                                                                  | Yair            | Phase 0 gate                      |
| D5  | Medical-track clinical relevance must stay general textbook knowledge, never applied to the demo scan.                                                                   | Reviewer        | Content review                    |
| R1  | Claude writes placeholder text only. Medical facts that ship as `reviewed` are authored or approved by a person. Claude never marks content `reviewed`.                  | Claude          | Always                            |
