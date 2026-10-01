"""Prepares the static data for the online demo (docs/online/PLAN.md).

Imports the two teaching cases (the demo study and the glioma case, see
docs/pathology/PLAN.md) with the app's own pipeline into a temporary library,
then writes only what the online page needs:

    <out>/demo.json             the patients and studies, as the library lists them
    <out>/studies/<id>.json     each study's manifest (series, geometry, display ranges)
    <out>/volumes/<id>.nii.gz   the prepared volumes
    <out>/meshes/<id>.stl       3D models of the glioma case's expert regions

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
from fetch_teaching_case import CASE, build_archive  # noqa: E402

DEMO = ROOT / 'demo' / 'jane-head-mri.zip'
DEMO_SHA256 = '247b778cc557f6b474ed154cc56841cb8faaad05bf9d5456bee7f2c0cc213124'
MAX_BYTES = 200 * 1024 * 1024
# The published teaching cases (lib/library.ts TEACHING_CASES): name, notes, archive.
CASES = [
    ('jane', 'Jane', 'Demo study shipped with OpenMRI (demo/jane-head-mri.zip).'),
    ('glioma', 'Glioma teaching case',
     'Glioma teaching case BRATS_449, Medical Segmentation Decathlon (CC BY-SA 4.0).'),
]


def import_archive(root, archive, name):
    """Imports one archive with the app's own pipeline; returns its patient id."""
    db = sqlite3.connect(root / 'library.sqlite')
    job = str(uuid.uuid4())
    (root / 'jobs' / job).mkdir(parents=True)
    shutil.copy(archive, root / 'jobs' / job / 'source.zip')
    db.execute(
        'INSERT INTO jobs(id,status,stage,filename,sha256,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
        (job, 'inspecting', 'online build', archive.name,
         hashlib.sha256(Path(archive).read_bytes()).hexdigest(), 'now', 'now'),
    )
    db.commit()
    import_step(str(root), job, 'inspect')
    db.execute("UPDATE jobs SET status='processing',result=? WHERE id=?",
               (json.dumps({'patient': {'name': name}}), job))
    db.commit()
    import_step(str(root), job, 'convert')
    db.close()


def build(out):
    out = Path(out)
    if hashlib.sha256(DEMO.read_bytes()).hexdigest() != DEMO_SHA256:
        raise SystemExit('demo/jane-head-mri.zip is not the published demo archive')
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        glioma = build_archive(root / 'glioma-teaching-case.zip')  # checked against its fingerprints
        if hashlib.sha256(glioma.read_bytes()).hexdigest() != CASE['archive_sha256']:
            raise SystemExit('The glioma archive does not match its recorded fingerprint')
        # The library schema lives in lib/library.ts; create it the same way the tests do.
        subprocess.run(
            ['node', '--experimental-strip-types', '--no-warnings', '-e', "import('./lib/library.ts').then(m=>m.db())"],
            cwd=ROOT, env={**os.environ, 'OPENMRI_DATA_DIR': str(root)}, check=True, capture_output=True,
        )
        archives = {'jane': DEMO, 'glioma': glioma}
        hashes = {'jane': DEMO_SHA256, 'glioma': CASE['archive_sha256']}
        for case, name, _ in CASES:
            import_archive(root, archives[case], name)

        db = sqlite3.connect(root / 'library.sqlite')
        db.row_factory = sqlite3.Row
        if out.exists():
            shutil.rmtree(out)
        for folder in ('volumes', 'meshes', 'studies'):
            (out / folder).mkdir(parents=True)
        patients, studies = [], []
        for case, name, notes in CASES:
            study = db.execute('SELECT * FROM studies WHERE source_hash=?', (hashes[case],)).fetchone()
            manifest = json.loads(study['manifest'])
            for series in manifest['series']:
                path = db.execute('SELECT path FROM assets WHERE id=?', (series['id'],)).fetchone()['path']
                shutil.copy(root / path, out / 'volumes' / f"{series['id']}.nii.gz")
                for mesh in series.get('meshes', []):
                    mesh_id = mesh['url'].rsplit('/', 1)[1]
                    path = db.execute('SELECT path FROM assets WHERE id=?', (mesh_id,)).fetchone()['path']
                    shutil.copy(root / path, out / 'meshes' / f'{mesh_id}.stl')
            (out / 'studies' / f"{study['id']}.json").write_text(json.dumps(manifest))
            patients.append({'id': study['patient_id'], 'name': name, 'birth_date': '', 'sex': '', 'notes': notes})
            studies.append({'id': study['id'], 'patient_id': study['patient_id'], 'date': study['date'],
                            'label': study['label'], 'body_part': study['body_part'],
                            'created_at': study['created_at'], 'teachingCase': case})
        db.close()

    (out / 'demo.json').write_text(json.dumps({'patients': patients, 'studies': studies}))
    total = sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
    if total > MAX_BYTES:
        raise SystemExit(f'Online data is {total >> 20} MB, above the {MAX_BYTES >> 20} MB budget')
    return total


if __name__ == '__main__':
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'online' / 'public' / 'data'
    size = build(target)
    print(f'Online data written to {target} ({size / 1024 / 1024:.0f} MB)')
