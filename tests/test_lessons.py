import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from check_lessons import ROOT, check, point_problem

REFERENCE = '02 Axial MPRAGE'


class LessonGeometryTests(unittest.TestCase):
    def test_shipped_lessons_sit_inside_the_head(self):
        self.assertEqual(check(ROOT / 'lessons'), [])

    def test_points_in_air_or_outside_the_volume_are_rejected(self):
        self.assertIsNone(point_problem(REFERENCE, [0, -10, 10]))  # lateral ventricles: dark, but inside
        self.assertIn('outside the head', point_problem(REFERENCE, [0, 90, 20]))  # in front of the forehead
        self.assertIn('outside the "02 Axial MPRAGE" volume', point_problem(REFERENCE, [0, 0, 100]))

    def test_unknown_series_and_misplaced_landmarks_are_reported(self):
        lesson = json.loads((ROOT / 'lessons' / 'brainstem.json').read_text())
        lesson['landmarks'][0]['point'] = [0, 90, 20]
        lesson['kind'] = 'sequence-compare'
        lesson['compareSeries'] = '99 Missing series'
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'brainstem.json').write_text(json.dumps(lesson))
            problems = check(directory)
        self.assertTrue(any('midbrain' in p and 'outside the head' in p for p in problems), problems)
        self.assertTrue(any('"99 Missing series" is not in the demo' in p for p in problems), problems)


    @unittest.skipIf(os.environ.get('OPENMRI_OFFLINE') == '1', 'needs the glioma case')
    def test_landmarks_must_lie_in_the_region_they_name(self):
        lesson = json.loads((ROOT / 'lessons' / 'glioma.json').read_text())
        rim = next(l for l in lesson['landmarks'] if l['id'] == 'enhancing-rim')
        rim['region'] = 1
        core = next(l for l in lesson['landmarks'] if l['id'] == 'core')
        core['point'] = [107, 112, 89]  # the ventricle, outside every region
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'glioma.json').write_text(json.dumps(lesson))
            problems = check(directory)
        self.assertTrue(any('enhancing-rim' in p and 'in region 3, not region 1' in p for p in problems), problems)
        self.assertTrue(any('core' in p and 'in region 0, not region 2' in p for p in problems), problems)
        self.assertEqual(len(problems), 2, problems)


if __name__ == '__main__':
    unittest.main()
