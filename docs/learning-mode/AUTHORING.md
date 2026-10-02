# Authoring and reviewing lessons

Lessons are JSON files in [`lessons/`](../../lessons). You never edit code to
add or change one. Checks catch structural and placement mistakes; a person
checks the medicine.

## Set up once

```sh
npm ci
npm run setup      # Python environment, needed for the geometry check
npm run demo       # starts the app with the demo study
```

## Add a landmark

1. **Find the point.** Open Jane's study, choose the lesson's series (for
   most lessons `02 Axial MPRAGE`), click the structure on a slice and
   fine-tune with the scroll wheel. Check it in all three planes. The footer
   shows `X … Y … Z … mm`.
2. **Stay away from the operated area** in the patient's left upper
   hemisphere. Put one-sided structures on the patient's right.
3. **Add the entry** to the lesson's `landmarks`, in teaching order:

   ```json
   {
     "id": "red-nucleus",
     "name": "Red nucleus (right)",
     "point": [5, -20, -10],
     "tracks": ["med"],
     "text": { "med": "…" },
     "toleranceMm": 4,
     "review": { "status": "draft" }
   }
   ```

   `tracks` decides who sees it. Write `text` for exactly those tracks.
   Link glossary terms with `[[id]]` or `[[id|shown words]]`.

4. **Optionally add a question** to `questions`:
   `{ "id": "find-red-nucleus", "type": "find", "tracks": ["med"], "landmark": "red-nucleus" }`.
5. **Run the checks.**

   ```sh
   npm run lessons:check                           # structure, text, links, review rules
   .venv/bin/python scripts/check_lessons.py       # the point is inside the head on the real scan
   ```

   Both print exactly what is wrong, for example
   `lesson brainstem landmark red-nucleus: missing undergrad text` or
   `brainstem.json landmark red-nucleus: point [5, 90, -10] is outside the head`.

6. **Look at it in the app.** `npm run build && npm run up`, then open
   **Learn**. Content is bundled at build time.

## Lessons on the glioma case

Every lesson names its teaching case: `"case": "jane"` (the demo study) or
`"case": "glioma"` (`npm run demo:pathology`). The panel lists only the open
case's lessons, and `order` is counted per case. A lesson on the glioma case
can show the expert regions of a label map:

```json
"labelSeries": "05 Tumour labels (expert)",
"regions": [
  { "value": 1, "name": "Edema", "color": "#facc15", "opacity": 0.35 },
  { "value": 3, "name": "Enhancing tumour", "color": "#3b82f6" }
],
"source": {
  "text": "Medical Segmentation Decathlon, BRATS_449 (Simpson et al. 2019)",
  "url": "https://medicaldecathlon.com",
  "license": "CC BY-SA 4.0"
}
```

`value` is the number in the label map, `opacity` that of the region's 3D
model. A landmark may add `"region": 3`; the geometry check then requires its
point to lie in that region of the label map. Third-party data always needs a
`source`. Write about how these findings look in general: never a diagnosis,
grade or prognosis for the person scanned, and do not name the tumour's side
until the reviewer has confirmed the orientation.

## Review

Every item starts as `{ "status": "draft" }` and shows **Draft, not
reviewed** in the app. The reviewer goes through each landmark and question
with this checklist:

- [ ] The point sits on the named structure in all three planes.
- [ ] The anatomy there looks typical, away from the operated area.
- [ ] The text is correct, and right for each track's level.
- [ ] Clinical notes are general knowledge and never describe this scan.
- [ ] Glioma case: the outline colours match the legend, the left–right
      orientation of the case is confirmed, and no text reads as a diagnosis.
- [ ] Choice questions have exactly one right answer.

Then, and only then, the item gets:

```json
{
  "status": "reviewed",
  "reviewer": "Full Name",
  "role": "MS3 / PGY-2 radiology",
  "date": "2026-10-15"
}
```

The check refuses `reviewed` without a name, role and date. The app then
shows **Reviewed by …** instead of the draft badge. Record corrections in the
pull request so the history shows what the reviewer changed.

## Before a pull request

```sh
npm run gate       # every check, the build and the browser tests
```
