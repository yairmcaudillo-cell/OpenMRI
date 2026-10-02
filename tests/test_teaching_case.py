import hashlib
import io
import os
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

import nibabel as nib
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from fetch_teaching_case import CASE, SERIES, build_archive

# The case is downloaded from the official archive. Set OPENMRI_OFFLINE=1 to
# skip these tests on a machine without internet; CI always runs them.
OFFLINE = os.environ.get('OPENMRI_OFFLINE') == '1'


@unittest.skipIf(OFFLINE, 'OPENMRI_OFFLINE=1')
class TeachingCaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.first = build_archive(Path(cls.temp.name) / 'a.zip')
        cls.second = build_archive(Path(cls.temp.name) / 'b.zip')

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_the_archive_is_identical_on_every_build(self):
        sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
        self.assertEqual(sha(self.first), sha(self.second))
        self.assertEqual(sha(self.first), CASE['archive_sha256'])

    def test_four_sequences_and_the_expert_labels(self):
        with zipfile.ZipFile(self.first) as z:
            names = z.namelist()
            self.assertEqual(names, [s['file'] for s in SERIES] + ['ATTRIBUTION.txt'])
            self.assertIn('CC BY-SA 4.0', z.read('ATTRIBUTION.txt').decode())
            volumes = {n: nib.Nifti1Image.from_bytes(z.read(n)) for n in names[:-1]}
        shapes = {v.shape for v in volumes.values()}
        self.assertEqual(shapes, {(240, 240, 155)})
        labels = np.asarray(volumes[SERIES[-1]['file']].dataobj)
        self.assertEqual(sorted(np.unique(labels)), [0, 1, 2, 3])
        flair = np.asarray(volumes[SERIES[0]['file']].dataobj)
        self.assertGreater(flair.max(), 0)


if __name__ == '__main__':
    unittest.main()
