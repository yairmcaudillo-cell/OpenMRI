import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

// Learning mode is offered only on teaching cases (the demo and the glioma
// case), recognised by the hash of their archive, never by the patient's name.
const archive = fs.readFileSync(
  new URL('../demo/jane-head-mri.zip', import.meta.url),
);
const demoHash = createHash('sha256').update(archive).digest('hex');
// The glioma archive is built by scripts/fetch_teaching_case.py, which records its hash.
const gliomaHash = /'archive_sha256': '([0-9a-f]{64})'/.exec(
  fs.readFileSync(
    new URL('../scripts/fetch_teaching_case.py', import.meta.url),
    'utf8',
  ),
)[1];
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openmri-demo-'));
process.env.OPENMRI_DATA_DIR = root;
const seed = new DatabaseSync(path.join(root, 'library.sqlite'));
const manifest = JSON.stringify({
  series: [{ id: 'a', url: '/api/library/assets/a' }],
});
seed.exec(`
  CREATE TABLE patients(id TEXT PRIMARY KEY,name TEXT NOT NULL,birth_date TEXT DEFAULT '',sex TEXT DEFAULT '',notes TEXT DEFAULT '',created_at TEXT NOT NULL);
  CREATE TABLE studies(id TEXT PRIMARY KEY,patient_id TEXT NOT NULL REFERENCES patients(id),study_uid TEXT NOT NULL,date TEXT NOT NULL,label TEXT NOT NULL,body_part TEXT DEFAULT '',manifest TEXT NOT NULL,source_hash TEXT DEFAULT '',created_at TEXT NOT NULL,UNIQUE(patient_id,study_uid));
  INSERT INTO patients VALUES('renamed','Not Jane','','','','now'),('jane','Jane','','','','now'),('g','Glioma case','','','','now');
  INSERT INTO studies VALUES('demo','renamed','1','','MR','','${manifest}','${demoHash}','now');
  INSERT INTO studies VALUES('real','jane','2','2024-01-01','MR','HEAD','${manifest}','0123abcd','now');
  INSERT INTO studies VALUES('glioma','g','3','','MR','','${manifest}','${gliomaHash}','now');
`);
seed.close();
const code = ts.transpileModule(
  fs.readFileSync(new URL('../lib/library.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  },
).outputText;
const library = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

test('the recorded case hashes match the demo archive and the fetch script', () => {
  assert.equal(library.TEACHING_CASES.jane, demoHash);
  assert.equal(library.TEACHING_CASES.glioma, gliomaHash);
});

test('studies carry their teaching case by archive hash, whatever the patient is called', () => {
  const studies = library.catalogStudies();
  const byId = Object.fromEntries(studies.map((s) => [s.id, s]));
  assert.equal(byId.demo.teachingCase, 'jane');
  assert.equal(byId.glioma.teachingCase, 'glioma');
  assert.equal(byId.real.teachingCase, null);
  assert.ok(
    !JSON.stringify(studies).includes(demoHash),
    'the hash is not sent',
  );
  assert.equal(studies[0].id, 'real', 'newest date first, as before');
  assert.deepEqual(studies.map((s) => s.id).sort(), ['demo', 'glioma', 'real']);
});
