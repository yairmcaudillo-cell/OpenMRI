"""Geometry check for learning-mode lessons on their real teaching cases.

Every landmark must lie inside its lesson's reference series and inside the
head, not in the air around it, and every named series must exist in the
case. A landmark that names an expert region must lie in that region of the
lesson's label map. It checks where an author put a point; it measures
nothing about the scan.

The glioma case is fetched (and cached) on first use; with OPENMRI_OFFLINE=1
its lessons are skipped.

    .venv/bin/python scripts/check_lessons.py [lessons-dir]
"""
import gzip
import json
import os
import sys
import zipfile
from functools import lru_cache
from pathlib import Path

import nibabel as nib
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'demo' / 'jane-head-mri.zip'
GLIOMA = ROOT / '.cache' / 'glioma-teaching-case.zip'
CASE_NAMES = {'jane': 'the demo', 'glioma': 'the glioma case'}


@lru_cache(maxsize=None)
def archive(case):
    if case == 'jane':
        return DEMO
    if not GLIOMA.exists():
        from fetch_teaching_case import build_archive
        build_archive(GLIOMA)
    return GLIOMA


@lru_cache(maxsize=None)
def volume(case, description):
    """Canonical image of one series of a case, or None."""
    with zipfile.ZipFile(archive(case)) as z:
        for name in (f'{description}.nii.gz', f'{description}.nii'):
            if name in z.namelist():
                data = z.read(name)
                if name.endswith('.gz'):
                    data = gzip.decompress(data)
                return nib.as_closest_canonical(nib.Nifti1Image.from_bytes(data))
    return None


@lru_cache(maxsize=None)
def series(description, case='jane'):
    """Canonical volume and head mask of one series.

    The import reorients volumes the same way (as_closest_canonical), which
    changes voxel order but not world coordinates, so points in RAS mm match
    what the viewer shows.
    """
    image = volume(case, description)
    if image is None:
        return None
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


def voxel(affine, shape, point):
    ijk = np.rint(nib.affines.apply_affine(np.linalg.inv(affine), point)).astype(int)
    return None if np.any(ijk < 0) or np.any(ijk >= shape) else tuple(ijk)


def point_problem(description, point, case='jane'):
    """Why a point is not acceptable on a series, or None."""
    loaded = series(description, case)
    if loaded is None:
        return f'series "{description}" is not in {CASE_NAMES[case]}'
    affine, head = loaded
    ijk = voxel(affine, head.shape, point)
    if ijk is None:
        return f'point {point} is outside the "{description}" volume'
    if not head[ijk]:
        return f'point {point} is outside the head on "{description}"'
    return None


def region_problem(description, point, region, case):
    """Why a point is not in the expert region it names, or None."""
    image = volume(case, description)
    if image is None:
        return f'label series "{description}" is not in {CASE_NAMES[case]}'
    ijk = voxel(image.affine, image.shape, point)
    found = None if ijk is None else int(np.asarray(image.dataobj[ijk]))
    if found != region:
        return f'point {point} is in region {found}, not region {region}'
    return None


def check(directory):
    problems = []
    for path in sorted(Path(directory).glob('*.json')):
        if path.name == 'glossary.json':
            continue
        lesson = json.loads(path.read_text())
        case = lesson.get('case', 'jane')
        if case != 'jane' and os.environ.get('OPENMRI_OFFLINE') == '1':
            print(f'{path.name}: skipped offline', file=sys.stderr)
            continue
        names = [lesson['referenceSeries']] + ([lesson['compareSeries']] if lesson.get('compareSeries') else [])
        for name in names:
            if series(name, case) is None:
                problems.append(f'{path.name}: series "{name}" is not in {CASE_NAMES[case]}')
        for landmark in lesson['landmarks']:
            for name in names:
                problem = point_problem(name, landmark['point'], case)
                if problem:
                    problems.append(f"{path.name} landmark {landmark['id']}: {problem}")
            if 'region' in landmark:
                problem = region_problem(lesson['labelSeries'], landmark['point'], landmark['region'], case)
                if problem:
                    problems.append(f"{path.name} landmark {landmark['id']}: {problem}")
    return problems


if __name__ == '__main__':
    found = check(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'lessons')
    for p in found:
        print(p, file=sys.stderr)
    print(f'{len(found)} geometry problem(s)' if found else 'Lesson geometry OK')
    sys.exit(1 if found else 0)
