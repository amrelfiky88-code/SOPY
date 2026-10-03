import { defineConfig, devices } from '@playwright/test';

// Browser tests for SOPY's critical paths, at phone size.
//
// They run against a server that's already up with the production build:
//   npm run build:web
//   (from server/) NODE_ENV=production PORT=4100 node --env-file=.env src/index.js
//   npm run test:e2e
// E2E_BASE_URL points them elsewhere (default http://127.0.0.1:4100).
// Each test makes its own business through the API (checkout in demo mode,
// so no Paddle keys), so they don't depend on existing data.
// E2E_CHANNEL picks the installed browser (default msedge; "chrome" works
// too, or leave it empty after `npx playwright install chromium`).
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4100',
    ...devices['Pixel 5'],
    viewport: { width: 375, height: 812 },
    channel: process.env.E2E_CHANNEL ?? 'msedge',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
});
