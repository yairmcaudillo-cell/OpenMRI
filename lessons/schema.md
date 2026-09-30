# Lesson file reference

Each lesson is one JSON file in this folder, named after its id
(`brainstem.json` has `"id": "brainstem"`). The app picks up every file here
automatically. `glossary.json` holds the shared terms. After any change, run:

```sh
npm run lessons:check   # structure, text per track, review rules, glossary links
npm run test:import     # includes the geometry check on the real demo scan
```

## Lesson

| Field             | Required           | Meaning                                                                |
| ----------------- | ------------------ | ---------------------------------------------------------------------- |
| `id`              | yes                | Lowercase words joined by hyphens. Same as the file name.              |
| `kind`            | yes                | `landmarks`, or `sequence-compare` to show two series side by side.    |
| `order`           | yes                | Position in the lesson list, from 1. No two lessons share a number.    |
| `tracks`          | yes                | `["undergrad"]`, `["med"]` or both.                                    |
| `title`           | yes                | Text per track, e.g. `{ "undergrad": "…", "med": "…" }`.               |
| `summary`         | yes                | Text per track, shown under the title.                                 |
| `referenceSeries` | yes                | Demo series the points are placed on, by name, e.g. `02 Axial MPRAGE`. |
| `compareSeries`   | `sequence-compare` | Second demo series shown beside the reference.                         |
| `landmarks`       | yes                | List of landmarks (below), in teaching order.                          |
| `questions`       | yes                | List of quiz questions (below). May be empty.                          |
| `review`          | yes                | Review of the lesson's own title and summary (below).                  |

## Landmark

| Field         | Meaning                                                                           |
| ------------- | --------------------------------------------------------------------------------- |
| `id`          | Unique within the lesson.                                                         |
| `name`        | Shown in the list, e.g. `Thalamus (right)`.                                       |
| `point`       | `[x, y, z]` in millimetres, RAS: x to the patient's right, y to the front, z up.  |
| `tracks`      | Tracks the landmark appears in; a subset of the lesson's tracks.                  |
| `text`        | Text per track, for every track in `tracks` and no others.                        |
| `toleranceMm` | How close a quiz click must be, 3 to 20 mm. Small structures 4–6, lobes about 10. |
| `review`      | See below.                                                                        |

**Placing a point.** Open the demo, open the lesson's reference series, click
the structure in a slice and fine-tune with the scroll wheel. The footer shows
the focus as `X … Y … Z … mm`; copy those numbers. Check the point in all three
planes. Avoid the operated area in the patient's left upper hemisphere: the
demo shows a brain after surgery, and lessons teach typical anatomy only.

## Questions

A **find** question names a landmark; the student clicks it on a slice.

```json
{
  "id": "find-pons",
  "type": "find",
  "tracks": ["undergrad", "med"],
  "landmark": "pons"
}
```

A **choice** question has a prompt per track, two or more different options,
and the index of the right one (from 0). `landmark` is optional and moves the
marker there while the question is shown; `explanation` is optional and shown
after answering.

```json
{
  "id": "brainstem-order",
  "type": "choice",
  "tracks": ["undergrad"],
  "prompt": {
    "undergrad": "From top to bottom, what are the parts of the brainstem?"
  },
  "options": ["Midbrain, pons, medulla", "Medulla, pons, midbrain"],
  "answer": 0,
  "review": { "status": "draft" }
}
```

## Glossary terms in text

Write `[[csf]]` to link a glossary term, or `[[ventricle|ventricles]]` to show
different words. Terms appear underlined with the definition on hover or
keyboard focus. Every linked id must exist in `glossary.json`:

```json
{
  "id": "csf",
  "term": "Cerebrospinal fluid (CSF)",
  "definition": "…",
  "review": { "status": "draft" }
}
```

## Review

Everything starts as `{ "status": "draft" }` and shows a **Draft, not
reviewed** badge in the app. Only the reviewer, or the maintainer on their
written behalf, changes it after checking the item:

```json
{
  "status": "reviewed",
  "reviewer": "Full Name",
  "role": "PGY-2 radiology resident",
  "date": "2026-10-15"
}
```

Reviewer checklist for each landmark: the point sits on the named structure in
all three planes; the anatomy there looks typical, away from the operated
area; the text is correct and at the right level for each track; nothing
describes this person's own findings.
