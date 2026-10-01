"""Geometry check for learning-mode lessons on the real demo archive.

Every landmark must lie inside its lesson's reference series and inside the
head, not in the air around it, and every named series must exist in the demo.
It checks where an author put a point; it measures nothing about the scan.

    .venv/bin/python scripts/check_lessons.py [lessons-dir]
"""
import gzip
import json
import sys
import zipfile
from functools import lru_cache
from pathlib import Path

import nibabel as nib
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'demo' / 'jane-head-mri.zip'


@lru_cache(maxsize=None)
def series(description):
    """Canonical volume and head mask of one demo series.

    The import reorients volumes the same way (as_closest_canonical), which
    changes voxel order but not world coordinates, so points in RAS mm match
    what the viewer shows.
    """
    with zipfile.ZipFile(DEMO) as z:
        name = f'{description}.nii.gz'
        if name not in z.namelist():
            return None
        image = nib.as_closest_canonical(nib.Nifti1Image.from_bytes(gzip.decompress(z.read(name))))
    data = np.asarray(image.dataobj, dtype=np.float32)
    # Air is near zero; anything clearly above it and connected is the head.
    # Filling holes keeps dark fluid inside the head (ventricles, eyes).
    head = ndimage.binary_closing(data > 0.08 * np.percentile(data, 99), iterations=2)
    labels, count = ndimage.label(head)
    if count:
        head = labels == (np.argmax(np.bincount(labels.ravel())[1:]) + 1)
    for axis in range(3):  # 2D hole filling per slice closes open-ended cavities
        filled = [ndimage.binary_fill_holes(s) for s in np.moveaxis(head, axis, 0)]
        head = np.stack(filled, axis=axis)
    return image.affine, head


def point_problem(description, point):
    """Why a point is not acceptable on a series, or None."""
    loaded = series(description)
    if loaded is None:
        return f'series "{description}" is not in the demo'
    affine, head = loaded
    ijk = np.rint(nib.affines.apply_affine(np.linalg.inv(affine), point)).astype(int)
    if np.any(ijk < 0) or np.any(ijk >= head.shape):
        return f'point {point} is outside the "{description}" volume'
    if not head[tuple(ijk)]:
        return f'point {point} is outside the head on "{description}"'
    return None


def check(directory):
    problems = []
    for path in sorted(Path(directory).glob('*.json')):
        if path.name == 'glossary.json':
            continue
        lesson = json.loads(path.read_text())
        names = [lesson['referenceSeries']] + ([lesson['compareSeries']] if lesson.get('compareSeries') else [])
        for name in names:
            if series(name) is None:
                problems.append(f'{path.name}: series "{name}" is not in the demo')
        for landmark in lesson['landmarks']:
            for name in names:
                problem = point_problem(name, landmark['point'])
                if problem:
                    problems.append(f"{path.name} landmark {landmark['id']}: {problem}")
    return problems


if __name__ == '__main__':
    found = check(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'lessons')
    for p in found:
        print(p, file=sys.stderr)
    print(f'{len(found)} geometry problem(s)' if found else 'Lesson geometry OK')
    sys.exit(1 if found else 0)
