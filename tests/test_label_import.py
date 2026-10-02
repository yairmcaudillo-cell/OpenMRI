import hashlib
import json
import os
import sqlite3
import struct
import subprocess
import sys
import tempfile
import unittest
import uuid
import zipfile
from pathlib import Path

import nibabel as nib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_mri import main


def nifti(data, affine):
    return nib.Nifti1Image(data, affine).to_bytes()


class LabelImportTests(unittest.TestCase):
    """A label map imports as a labelled series with one 3D mesh per region."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        subprocess.run(
            ['node', '--experimental-strip-types', '-e', "import('./lib/library.ts').then(m=>m.db())"],
            cwd=ROOT, env={**os.environ, 'OPENMRI_DATA_DIR': str(self.root)}, check=True, capture_output=True,
        )
        self.db = sqlite3.connect(self.root / 'library.sqlite')

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def run_import(self, entries):
        job = str(uuid.uuid4())
        work = self.root / 'jobs' / job
        work.mkdir(parents=True)
        with zipfile.ZipFile(work / 'source.zip', 'w') as z:
            for name, data in entries:
                z.writestr(name, data)
        sha = hashlib.sha256((work / 'source.zip').read_bytes()).hexdigest()
        self.db.execute(
            'INSERT INTO jobs(id,status,stage,filename,sha256,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
            (job, 'inspecting', 't', 't.zip', sha, 'now', 'now'),
        )
        self.db.commit()
        main(str(self.root), job, 'inspect')
        self.db.execute("UPDATE jobs SET status='processing',result=? WHERE id=?",
                        (json.dumps({'patient': {'name': 'Test'}}), job))
        self.db.commit()
        main(str(self.root), job, 'convert')
        manifest = json.loads(self.db.execute('SELECT manifest FROM studies').fetchone()[0])
        return {s['originalSeriesDescription']: s for s in manifest['series']}

    def test_label_map_gets_regions_and_meshes_and_scans_are_unchanged(self):
        affine = np.diag([1.5, 1.5, 2.0, 1.0])
        affine[:3, 3] = [-30, -30, -20]
        i, j, k = np.mgrid[:40, :40, :30]  # voxel indices, as the volume stores them
        scan = (i + j + k).astype(np.float32)
        labels = np.zeros((40, 40, 30), np.uint8)
        labels[((i - 20) ** 2 + (j - 20) ** 2 + (k - 15) ** 2) < 49] = 1
        labels[((i - 20) ** 2 + (j - 20) ** 2 + (k - 15) ** 2) < 9] = 2
        series = self.run_import([
            ('scan.nii', nifti(scan, affine)),
            ('tumour labels.nii', nifti(labels, affine)),
        ])
        label, plain = series['tumour labels'], series['scan']
        self.assertNotIn('labelMap', plain)
        self.assertNotIn('meshes', plain)
        self.assertEqual(label['labelMap'], {'values': [1, 2]})
        self.assertEqual(label['displayRange'], [0.0, 2.0])
        self.assertEqual([m['value'] for m in label['meshes']], [1, 2])
        stored = np.asarray(nib.load(self.root / 'volumes' / f"{label['id']}.nii.gz").dataobj)
        self.assertEqual(sorted(np.unique(stored)), [0, 1, 2])  # no interpolated values
        for mesh in label['meshes']:
            mesh_id = mesh['url'].rsplit('/', 1)[1]
            path, size = self.db.execute('SELECT path,size FROM assets WHERE id=?', (mesh_id,)).fetchone()
            data = (self.root / path).read_bytes()
            self.assertEqual(struct.unpack('<I', data[80:84])[0], mesh['triangles'])
            self.assertEqual(len(data), size)
            vertices = np.frombuffer(data, dtype=[('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')],
                                     offset=84)['v'].reshape(-1, 3)
            # The mesh sits where the region is, in world millimetres.
            centre = affine @ np.array([20, 20, 15, 1])
            self.assertTrue(np.allclose(vertices.mean(axis=0), centre[:3], atol=1.5))

    def test_an_integer_scan_is_not_a_label_map_without_a_label_name(self):
        data = np.zeros((20, 20, 20), np.uint8)
        data[5:10, 5:10, 5:10] = 1
        series = self.run_import([('integer scan.nii', nifti(data, np.eye(4)))])
        self.assertNotIn('labelMap', series['integer scan'])


if __name__ == '__main__':
    unittest.main()
