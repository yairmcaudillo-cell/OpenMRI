import { defineConfig } from '@playwright/test';

// Browser tests for the static online demo (docs/online/PLAN.md). They serve
// dist-online/ with vite preview, the same files GitHub Pages serves.
// Run `npm run build:online` first; `npm run gate` does that.
export default defineConfig({
  testDir: 'tests/e2e-online',
  // Software WebGL on shared CI runners: one series switch can take ~45 s.
  timeout: 180_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4175/OpenMRI/',
    viewport: { width: 1440, height: 900 },
    // Software WebGL can keep the page busy for a long time after a load.
    actionTimeout: 45_000,
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npx vite preview --config vite.online.config.ts',
    url: 'http://127.0.0.1:4175/OpenMRI/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
