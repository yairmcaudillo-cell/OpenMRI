// Loads a teaching case through the local API: the demo study as patient
// "Jane" (default), or with --case glioma the glioma case from the Medical
// Segmentation Decathlon (downloaded by scripts/fetch_teaching_case.py).
//
// For the demo it loads the study as patient "Jane" and
// opens the welcome screen, where Jane's study is the first recent study.
// Clicking it plays the entering transition with sound; browsers only allow
// sound after a click, so the script does not open the study itself.
// Running it again reuses the demo that is already in the library. Needs a
// running server: `npm run demo` starts one first.
//
//   node scripts/demo.mjs [--no-open] [--case glioma]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// OPENMRI_PORT lets the browser tests load the demo into their own server.
// The host stays 127.0.0.1.
const BASE = `http://127.0.0.1:${Number(process.env.OPENMRI_PORT) || 4173}`;
const ROOT = path.join(import.meta.dirname, '..');
const GLIOMA = process.argv.includes('--case')
  ? process.argv[process.argv.indexOf('--case') + 1] === 'glioma'
  : false;
const CASE = GLIOMA
  ? {
      archive: path.join(ROOT, '.cache', 'glioma-teaching-case.zip'),
      name: 'Glioma teaching case',
      // Written into the notes, so no real patient record is ever reused.
      marker:
        'Glioma teaching case BRATS_449, Medical Segmentation Decathlon (CC BY-SA 4.0).',
    }
  : {
      archive: path.join(ROOT, 'demo', 'jane-head-mri.zip'),
      name: 'Jane',
      marker: 'Demo study shipped with OpenMRI (demo/jane-head-mri.zip).',
    };
const ARCHIVE = CASE.archive;
const MARKER = CASE.marker;
const openBrowser = !process.argv.includes('--no-open');

async function api(route, options = {}) {
  const r = await fetch(BASE + route, options);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `${route}: HTTP ${r.status}`);
  return body;
}
const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(jobId, status, seconds) {
  let stage = '';
  for (let i = 0; i < seconds; i++) {
    const job = await api(`/api/library/imports/${jobId}`);
    if (job.stage !== stage) {
      stage = job.stage;
      console.log(`  ${stage}`);
    }
    if (job.status === status) return job;
    if (job.status === 'error') throw new Error(job.error || 'Import failed');
    await sleep(1000);
  }
  throw new Error(`The import did not reach "${status}" in time`);
}

function open(url) {
  if (!openBrowser) return;
  const opener =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'explorer'
        : 'xdg-open';
  const r = spawnSync(opener, [url], { stdio: 'ignore' });
  if (r.error || r.status) console.log(`Open ${url} in your browser.`);
}

async function main() {
  const health = await fetch(`${BASE}/api/health`)
    .then((r) => r.json())
    .catch(() => null);
  if (health?.app !== 'openmri') {
    console.error(
      `OpenMRI is not running on ${BASE}. Run npm run demo, which starts it, or npm run up first.`,
    );
    process.exit(1);
  }
  const library = await api('/api/library');
  const jane = library.patients.find((p) => p.notes === MARKER);
  const existing =
    jane && library.studies.find((s) => s.patient_id === jane.id);
  if (existing) {
    console.log('The demo study is already in the library.');
    return finish();
  }

  if (GLIOMA) {
    // Downloads two files by byte range and checks their fingerprints.
    console.log('Fetching the glioma teaching case (about 7 MB).');
    const python = path.join(ROOT, '.venv', 'bin', 'python');
    const r = spawnSync(
      python,
      [path.join(ROOT, 'scripts', 'fetch_teaching_case.py'), ARCHIVE],
      {
        stdio: 'inherit',
      },
    );
    if (r.status !== 0) throw new Error('The glioma case could not be fetched');
  }
  console.log(
    `Importing the ${GLIOMA ? 'glioma teaching case' : 'demo study'} as patient ${CASE.name}.`,
  );
  const { id } = await api(
    '/api/library/imports',
    json('POST', { filename: path.basename(ARCHIVE) }),
  );
  try {
    await api(`/api/library/imports/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/zip' },
      body: readFileSync(ARCHIVE),
    });
    await waitFor(id, 'review', 300);
    await api(
      `/api/library/imports/${id}`,
      json('POST', {
        patient: jane ? { id: jane.id } : { name: CASE.name, notes: MARKER },
      }),
    );
    const done = await waitFor(id, 'complete', 900);
    return finish();
  } catch (error) {
    // Someone imported the same archive by hand under another name. That
    // copy is the demo; leave it alone and discard this draft.
    if (/already imported for another patient/.test(error.message)) {
      await api(`/api/library/imports/${id}`, { method: 'DELETE' }).catch(
        () => {},
      );
      console.log(
        'The demo archive is already in the library under another patient name. Open it from the library.',
      );
      console.log(`OpenMRI: ${BASE}/`);
      open(`${BASE}/`);
      return;
    }
    throw error;
  }
}

function finish() {
  console.log(
    `${CASE.name}'s study is ready. Open ${BASE}/ and click ${CASE.name} under Recent studies.`,
  );
  open(`${BASE}/`);
}

main().catch((error) => {
  console.error(`The demo could not be loaded: ${error.message}`);
  process.exit(1);
});
