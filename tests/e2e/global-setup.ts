import { execFileSync } from 'node:child_process';

/** Loads the demo study into the test server's own data directory. */
export default function globalSetup() {
  execFileSync('node', ['scripts/demo.mjs', '--no-open'], {
    env: { ...process.env, OPENMRI_PORT: '4174' },
    stdio: 'inherit',
    timeout: 900_000,
  });
}
