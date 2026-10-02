"""Fetches the glioma teaching case and packs it as an importable archive.

The case is BRATS_449 from the Medical Segmentation Decathlon brain tumour
set (CC BY-SA 4.0, see docs/pathology/PLAN.md). Only its two files are
downloaded, by byte range from the official archive, and each must match its
SHA-256 fingerprint. The 4D image is split into four series and written with
the expert label map into a ZIP that is byte-identical on every build, so the
app recognises the case by the archive's hash, as it does the demo.

    .venv/bin/python scripts/fetch_teaching_case.py [out.zip]
"""
import gzip
import hashlib
import sys
import urllib.request
import zipfile
from pathlib import Path

import nibabel as nib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'teaching-cases'
ARCHIVE_URL = 'https://msd-for-monai.s3-us-west-2.amazonaws.com/Task01_BrainTumour.tar'

CASE = {
    'id': 'glioma',
    'name': 'BRATS_449',
    # Byte ranges of the two members inside Task01_BrainTumour.tar.
    'image': {'offset': 30508032, 'size': 7084537,
              'sha256': 'ed83bc811d99b9550adc3352b7fdba8d403262e566edb7791ec22617199fab14'},
    'labels': {'offset': 7593774080, 'size': 31380,
               'sha256': '384ea5d4b374e8570f1843d2fe8899e03634de7515153d8181d78ce04f2f1475'},
    # SHA-256 of the packed ZIP; the app recognises the case by it.
    'archive_sha256': 'eff28d5f4ff9e4646753bc386e0c745e40e36b0e8097b58a562b755ab6e7b5b7',
}
# Channel order from the dataset's dataset.json: FLAIR, T1w, t1gd, T2w.
SERIES = [
    {'file': '01 FLAIR.nii', 'channel': 0},
    {'file': '02 T1.nii', 'channel': 1},
    {'file': '03 T1 +C.nii', 'channel': 2},  # +C: tagged as contrast by the importer
    {'file': '04 T2.nii', 'channel': 3},
    {'file': '05 Tumour labels (expert).nii', 'channel': None},
]
ATTRIBUTION = """Glioma teaching case for OpenMRI learning mode.

Source: Medical Segmentation Decathlon, Task01_BrainTumour, case BRATS_449
(derived from the BraTS 2016/2017 challenge data).
Simpson et al., "A large annotated medical image dataset for the development
and evaluation of segmentation algorithms", arXiv:1902.09063 (2019).
https://medicaldecathlon.com

License: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
Changes: the 4D image was split into four 3D series; the expert label map
(1 edema, 2 non-enhancing tumour, 3 enhancing tumour) is unchanged.
This archive is distributed under the same license.
"""
FIXED_TIME = (2018, 4, 5, 0, 0, 0)  # the dataset's release date


def fetch(member):
    """One member of the archive, from the cache or by byte range."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{member['sha256']}.nii.gz"
    if not path.exists():
        start = member['offset']
        request = urllib.request.Request(
            ARCHIVE_URL, headers={'Range': f"bytes={start}-{start + member['size'] - 1}"}
        )
        data = urllib.request.urlopen(request, timeout=300).read()
        if hashlib.sha256(data).hexdigest() != member['sha256']:
            raise SystemExit('The downloaded case does not match its fingerprint; refusing to use it')
        path.write_bytes(data)
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != member['sha256']:
        raise SystemExit(f'Cached file {path} is corrupt; delete it and run again')
    return nib.Nifti1Image.from_bytes(gzip.decompress(data))


def build_archive(out):
    image = fetch(CASE['image'])
    labels = fetch(CASE['labels'])
    data = np.asarray(image.dataobj, dtype=np.float32)
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as z:
        for series in SERIES:
            if series['channel'] is None:
                volume = nib.Nifti1Image(np.asarray(labels.dataobj, dtype=np.uint8), labels.affine)
            else:
                volume = nib.Nifti1Image(data[..., series['channel']], image.affine)
            volume.header.set_xyzt_units('mm')
            info = zipfile.ZipInfo(series['file'], FIXED_TIME)
            z.writestr(info, volume.to_bytes())
        z.writestr(zipfile.ZipInfo('ATTRIBUTION.txt', FIXED_TIME), ATTRIBUTION)
    return out


if __name__ == '__main__':
    target = build_archive(sys.argv[1] if len(sys.argv) > 1 else ROOT / '.cache' / 'glioma-teaching-case.zip')
    print(target, hashlib.sha256(target.read_bytes()).hexdigest())
