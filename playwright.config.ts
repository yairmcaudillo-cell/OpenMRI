import { defineConfig } from '@playwright/test';

// Browser tests run their own server on port 4174 with a throwaway data
// directory, so they never touch the user's library or a running app.
// Run `npm run build` first; `npm run gate` does that.
const PORT = 4174;
export const E2E_DATA_DIR = '.e2e-data';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `npx vinext start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { OPENMRI_DATA_DIR: E2E_DATA_DIR },
  },
});
