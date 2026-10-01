# Pathology lesson: plan and checkpoints

Goal: a lesson on a real brain tumour (glioma) for both tracks, with the
expert tumour outline shown on the slices and as a 3D model inside the brain,
in the local app and the online demo. Follows the loop, gate and stop rules
of [learning-mode/PLAN.md](../learning-mode/PLAN.md) §2–§5.

## Decisions (maintainer, 2026-10-01)

| ID   | Decision                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-D1 | A second real scan may be shown: one case of the Medical Segmentation Decathlon brain tumour set. It is **downloaded at build time**, never committed; it appears on the public site. |
| P-D2 | Its license is CC BY-SA 4.0 (stated in the dataset's own `dataset.json`). Data derived from it (prepared volumes, meshes) carries the same license and credit.                        |
| P-D3 | The lesson is reviewed by the medical reviewer before it is treated as final; until then it shows **Draft, not reviewed**, like all lessons.                                          |

## Principles

- **The outlines are the dataset's.** The tumour regions come from the expert
  label map published with the case. OpenMRI does not detect, measure, or
  segment anything; it draws what the dataset provides.
- **The case is identified, not guessed.** The build downloads two byte
  ranges of the official archive, and the files must match committed SHA-256
  fingerprints. The prepared archive is built deterministically, so the app
  can recognise it by hash, like the demo.
- **General teaching only.** Text explains how gliomas, edema and enhancement
  look in general; it does not give a diagnosis, grade or prognosis for this
  person.
- **Attribution travels with the data.** The lesson, the online page and the
  docs credit the source and state the license.

## Phases

| #   | Task                                                                                                                                                 | Acceptance                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| T0  | Spikes: range access, case choice (all three regions present, clear anatomy), geometry and labels, mesh generation, NiiVue overlay and mesh loading  | Evidence recorded below                                                                 |
| T1  | `scripts/fetch_teaching_case.py`: fetch by offsets, verify hashes, split the 4D image into four series plus the label map, write a deterministic ZIP | Test: hashes, five series, labels {0,1,2,3}, same ZIP bytes on every run                |
| T2  | Import pipeline: a label map becomes a labelled series with one 3D mesh (STL) per region                                                             | Test: meshes exist, lie inside the volume, one per label; ordinary series unchanged     |
| T3  | Teaching cases: the demo flag becomes a case id; lessons name their case; `npm run demo:pathology`; the online demo carries both cases               | Tests: case detection by hash, lessons only on their case, online catalogue             |
| T4  | Viewer: the lesson shows the label overlay on the slices and the meshes in 3D, with a legend and per-region toggles                                  | Browser test: overlay and meshes load, toggles work, nothing changes outside the lesson |
| T5  | Lesson content (draft): regions, sequences, mass effect in general terms; questions; glossary                                                        | lessons:check; geometry check that each landmark lies in the region it names            |
| T6  | Attribution, docs, gate, PR                                                                                                                          | Gate green; credit and license shown in the lesson, online page and docs                |

## Checkpoints

Appended below after each phase.

### CP-T0 · Spikes · 2026-10-01

- **Access.** The official archive (`msd-for-monai` on S3, 7.6 GB, plain
  `.tar`) answers byte-range requests. Walking all ~2,500 headers takes over
  an hour through the proxy, so the label region was found by a binary search
  for `ustar` headers in 20 MB windows (order: `imagesTr`, `imagesTs`,
  `labelsTr`), and all 484 label members were indexed from the last 90 MB.
- **License** read from the dataset's own `dataset.json`: `"licence":
"CC-BY-SA 4.0"`; channels FLAIR, T1w, t1gd, T2w; labels 1 edema,
  2 non-enhancing tumour, 3 enhancing tumour.
- **Case choice.** Label statistics for the 15 cases whose image offsets were
  known, then a visual check of the two best. **BRATS_449**: a frontal tumour
  with a classic enhancing rim around a non-enhancing core on T1 +C, edema on
  FLAIR, compression of the adjacent frontal horn; 5 connected components.
  BRATS_358 was mostly non-enhancing core.
- **Orientation.** Affine is identity (1 mm, RAS). Anterior verified on the
  axial FLAIR (frontal horns at +y); left–right is consistent with an RAS
  array but cannot be confirmed from anatomy alone. Lessons therefore do not
  name the tumour's side; the reviewer is asked to confirm.
- **Meshes.** NiiVue 0.69 loads meshes (`loadMeshes`, `addMesh`) but has no
  built-in isosurface. scikit-image would add 7 packages, so `scripts/meshes.py`
  builds surfaces from voxel faces with Taubin smoothing using numpy/scipy only.

### CP-T1 · Fetch and pack the case · 2026-10-01

`scripts/fetch_teaching_case.py`: two byte-range downloads (image 7.1 MB,
labels 31 KB), each checked against a committed SHA-256, cached in `.cache/`
(gitignored). The 4D image is split into `01 FLAIR`, `02 T1`, `03 T1 +C`,
`04 T2`, plus `05 Tumour labels (expert)` and `ATTRIBUTION.txt` (source,
paper, CC BY-SA 4.0, changes made). The ZIP is stored (no compression) with
fixed timestamps: identical bytes on every build, SHA-256 `eff28d5f…5b7`.
`tests/test_teaching_case.py` builds it twice and checks hashes, series,
shapes and labels {0,1,2,3}; `OPENMRI_OFFLINE=1` skips it without internet.

### CP-T2 · Label maps and meshes in the importer · 2026-10-01

A NIfTI series is a label map when its name contains label/segmentation/mask
**and** it holds a few non-negative whole numbers. Then: nearest-neighbour
resampling only, display range 0..max, `labelMap.values`, and one STL mesh
per region registered as an asset. Real case: 3 meshes (69k, 30k, 50k
triangles, 7 MB), import 3.3 s.

Errors caught by the loop:

- Real meshes had 133–420 non-manifold edges where voxels touch only along an
  edge (a problem for 3D printing). Mask smoothing reduced but did not remove
  them; filling one gap at each edge-only contact does: 0 on all three.
- The mirrored-grid test used `diag(-1,-1,1)`, a rotation (determinant +1),
  so a mutation of the mirror branch still passed. Now `diag(-1,1,1)`; the
  mutation fails.
- The world-position test allowed 1 mm, which a half-voxel slip passes;
  tightened to 0.3 mm.
- Two test bugs: an "integer scan" test file was named "mask-like scan" (a
  label name), and grid axes were named z, y, x while NumPy's first axis is
  the volume's first index.
- `03 T1 with contrast` did not get the contrast tag (the importer looks for
  `+C`); renamed `03 T1 +C`, archive rebuilt.

### CP-T3 · Teaching cases · 2026-10-01

The demo flag became a case id: `TEACHING_CASES` maps `jane` and `glioma` to
archive hashes, and each study reports `teachingCase`. Every lesson names its
`case`; the panel lists only the open case's lessons. The lesson schema gains
`labelSeries`, `regions` (value, name, colour), `source` (text, https url,
license) and a landmark `region`, each validated. `npm run demo:pathology`
fetches, packs and imports the case; the online build imports both cases and
ships their meshes. Errors caught: a hashing tie in study order made a test
depend on insertion order (now first by date plus the set), and a JSON rewrite
of the lessons broke their formatting (`npm run format`).
