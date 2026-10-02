import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from build_online_data import DEMO_SHA256, MAX_BYTES, build

sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


@unittest.skipIf(os.environ.get('OPENMRI_OFFLINE') == '1', 'the glioma case needs the internet')
class OnlineDataTests(unittest.TestCase):
    """The online demo publishes the two teaching cases and nothing else."""

    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.out = Path(cls.temp.name) / 'data'
        build(cls.out)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_the_demo_archive_is_the_published_one(self):
        self.assertEqual(sha(ROOT / 'demo' / 'jane-head-mri.zip'), DEMO_SHA256)

    def catalogue(self):
        return json.loads((self.out / 'demo.json').read_text())

    def test_every_study_manifest_lists_its_published_volumes_and_meshes(self):
        published = sorted(p.name for p in (self.out / 'volumes').iterdir())
        listed, meshes = [], []
        for study in self.catalogue()['studies']:
            manifest = json.loads((self.out / 'studies' / f"{study['id']}.json").read_text())
            for s in manifest['series']:
                listed.append(f"{s['id']}.nii.gz")
                self.assertEqual(sha(self.out / 'volumes' / f"{s['id']}.nii.gz"), s['sha256'])
                meshes += [m['url'].rsplit('/', 1)[1] for m in s.get('meshes', [])]
        self.assertEqual(published, sorted(listed))
        self.assertEqual(len(listed), 18 + 5)
        self.assertEqual(sorted(p.name for p in (self.out / 'meshes').iterdir()), sorted(f'{m}.stl' for m in meshes))
        self.assertEqual(len(meshes), 3)

    def test_catalogue_has_the_two_teaching_cases_and_no_personal_details(self):
        catalogue = self.catalogue()
        names = sorted(p['name'] for p in catalogue['patients'])
        self.assertEqual(names, ['Glioma teaching case', 'Jane'])
        self.assertTrue(all(p['birth_date'] == '' for p in catalogue['patients']))
        self.assertEqual(sorted(s['teachingCase'] for s in catalogue['studies']), ['glioma', 'jane'])
        files = sorted(str(p.relative_to(self.out)) for p in self.out.rglob('*') if p.is_file())
        self.assertEqual(
            [f for f in files if not f.startswith(('volumes/', 'meshes/', 'studies/'))],
            ['demo.json'],
        )

    def test_size_stays_within_budget(self):
        total = sum(p.stat().st_size for p in self.out.rglob('*') if p.is_file())
        self.assertLess(total, MAX_BYTES)


if __name__ == '__main__':
    unittest.main()
