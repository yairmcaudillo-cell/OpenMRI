import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_online_data import DEMO_SHA256, MAX_BYTES, build

sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


class OnlineDataTests(unittest.TestCase):
    """The online demo publishes the demo study and nothing else."""

    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.out = Path(cls.temp.name) / 'data'
        build(cls.out)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_only_the_demo_archive_is_used(self):
        self.assertEqual(sha(ROOT / 'demo' / 'jane-head-mri.zip'), DEMO_SHA256)

    def test_manifest_lists_every_published_volume_with_its_hash(self):
        manifest = json.loads((self.out / 'study.json').read_text())
        self.assertEqual(len(manifest['series']), 18)
        published = sorted(p.name for p in (self.out / 'volumes').iterdir())
        self.assertEqual(published, sorted(f"{s['id']}.nii.gz" for s in manifest['series']))
        for s in manifest['series']:
            self.assertEqual(sha(self.out / 'volumes' / f"{s['id']}.nii.gz"), s['sha256'])
        self.assertIn('02 Axial MPRAGE', [s['originalSeriesDescription'] for s in manifest['series']])

    def test_catalogue_has_one_demo_study_and_no_personal_details(self):
        catalogue = json.loads((self.out / 'demo.json').read_text())
        self.assertEqual(catalogue['patient']['name'], 'Jane')
        self.assertEqual(catalogue['patient']['birth_date'], '')
        self.assertEqual(len(catalogue['studies']), 1)
        self.assertTrue(catalogue['studies'][0]['demo'])
        files = sorted(str(p.relative_to(self.out)) for p in self.out.rglob('*') if p.is_file())
        self.assertEqual([f for f in files if not f.startswith('volumes/')], ['demo.json', 'study.json'])

    def test_size_stays_within_budget(self):
        total = sum(p.stat().st_size for p in self.out.rglob('*') if p.is_file())
        self.assertLess(total, MAX_BYTES)


if __name__ == '__main__':
    unittest.main()
