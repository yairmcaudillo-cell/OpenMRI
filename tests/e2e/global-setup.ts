import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:4174';
export const SYNTHETIC_PATIENT = 'Synthetic test volume';

async function api(route: string, init?: RequestInit) {
  const response = await fetch(BASE + route, init);
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) throw new Error(`${route}: ${String(body.error)}`);
  return body;
}
async function waitFor(id: string, status: string) {
  for (let i = 0; i < 300; i++) {
    const job = await api(`/api/library/imports/${id}`);
    if (job.status === status) return;
    if (job.status === 'error') throw new Error(String(job.error));
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Import did not reach ${status}`);
}

/** The glioma case needs the internet the first time (it is then cached). */
export const GLIOMA = process.env.OPENMRI_OFFLINE !== '1';

/**
 * Loads the teaching cases (the demo study and, online, the glioma case), and
 * a small synthetic NIfTI study so tests can check that learning mode stays
 * off on anything else. All go into the test server's own data directory.
 */
export default async function globalSetup() {
  for (const args of [[], ...(GLIOMA ? [['--case', 'glioma']] : [])])
    execFileSync('node', ['scripts/demo.mjs', '--no-open', ...args], {
      env: { ...process.env, OPENMRI_PORT: '4174' },
      stdio: 'inherit',
      timeout: 900_000,
    });
  const library = await api('/api/library');
  const patients = library.patients as { name: string }[];
  if (patients.some((p) => p.name === SYNTHETIC_PATIENT)) return;

  mkdirSync('.e2e-data', { recursive: true });
  const archive = path.resolve('.e2e-data/synthetic.zip');
  execFileSync('.venv/bin/python', [
    '-c',
    `import io, sys, zipfile, nibabel as nib, numpy as np
x, y, z = np.mgrid[:40, :48, :36]
volume = (1000 * np.exp(-((x - 20) ** 2 + (y - 24) ** 2 + (z - 18) ** 2) / 120)).astype(np.float32)
with zipfile.ZipFile(sys.argv[1], 'w') as archive:
    archive.writestr('synthetic.nii', nib.Nifti1Image(volume, np.diag([2, 2, 2, 1])).to_bytes())`,
    archive,
  ]);
  const { id } = await api('/api/library/imports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'synthetic.zip' }),
  });
  await api(`/api/library/imports/${String(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/zip' },
    body: readFileSync(archive),
  });
  await waitFor(String(id), 'review');
  await api(`/api/library/imports/${String(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient: { name: SYNTHETIC_PATIENT } }),
  });
  await waitFor(String(id), 'complete');
}
