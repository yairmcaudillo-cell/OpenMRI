"""Prepares the static data for the online demo (docs/online/PLAN.md).

Imports demo/jane-head-mri.zip with the app's own pipeline into a temporary
library, then writes only what the online page needs:

    <out>/demo.json            the patient and the one study, as the library lists them
    <out>/study.json           the study manifest (series, geometry, display ranges)
    <out>/volumes/<id>.nii.gz  the prepared volumes

Nothing else is published: no source archive, no database, no logs.

    .venv/bin/python scripts/build_online_data.py [out-dir]   (default online/public/data)
"""
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from import_mri import main as import_step  # noqa: E402

DEMO = ROOT / 'demo' / 'jane-head-mri.zip'
DEMO_SHA256 = '247b778cc557f6b474ed154cc56841cb8faaad05bf9d5456bee7f2c0cc213124'
MAX_BYTES = 150 * 1024 * 1024


def build(out):
    out = Path(out)
    archive_hash = hashlib.sha256(DEMO.read_bytes()).hexdigest()
    if archive_hash != DEMO_SHA256:
        raise SystemExit('demo/jane-head-mri.zip is not the published demo archive')
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        # The library schema lives in lib/library.ts; create it the same way the tests do.
        subprocess.run(
            ['node', '--experimental-strip-types', '--no-warnings', '-e', "import('./lib/library.ts').then(m=>m.db())"],
            cwd=ROOT, env={**os.environ, 'OPENMRI_DATA_DIR': str(root)}, check=True, capture_output=True,
        )
        job = str(uuid.uuid4())
        (root / 'jobs' / job).mkdir(parents=True)
        shutil.copy(DEMO, root / 'jobs' / job / 'source.zip')
        db = sqlite3.connect(root / 'library.sqlite')
        db.row_factory = sqlite3.Row
        db.execute(
            'INSERT INTO jobs(id,status,stage,filename,sha256,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
            (job, 'inspecting', 'online build', DEMO.name, archive_hash, 'now', 'now'),
        )
        db.commit()
        import_step(str(root), job, 'inspect')
        db.execute("UPDATE jobs SET status='processing',result=? WHERE id=?",
                   (json.dumps({'patient': {'name': 'Jane'}}), job))
        db.commit()
        import_step(str(root), job, 'convert')
        study = db.execute('SELECT * FROM studies').fetchone()
        patient = db.execute('SELECT * FROM patients').fetchone()
        manifest = json.loads(study['manifest'])

        if out.exists():
            shutil.rmtree(out)
        (out / 'volumes').mkdir(parents=True)
        for series in manifest['series']:
            path = db.execute('SELECT path FROM assets WHERE id=?', (series['id'],)).fetchone()['path']
            shutil.copy(root / path, out / 'volumes' / f"{series['id']}.nii.gz")
        db.close()

    (out / 'study.json').write_text(json.dumps(manifest))
    (out / 'demo.json').write_text(json.dumps({
        'patient': {'id': patient['id'], 'name': 'Jane', 'birth_date': '', 'sex': '',
                    'notes': 'Demo study shipped with OpenMRI (demo/jane-head-mri.zip).'},
        'studies': [{'id': study['id'], 'patient_id': patient['id'], 'date': study['date'],
                     'label': study['label'], 'body_part': study['body_part'],
                     'created_at': study['created_at'], 'demo': True}],
    }))
    total = sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
    if total > MAX_BYTES:
        raise SystemExit(f'Online data is {total >> 20} MB, above the {MAX_BYTES >> 20} MB budget')
    return total


if __name__ == '__main__':
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'online' / 'public' / 'data'
    size = build(target)
    print(f'Online data written to {target} ({size / 1024 / 1024:.0f} MB)')
