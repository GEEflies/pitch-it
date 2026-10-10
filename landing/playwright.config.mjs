import { defineConfig } from '@playwright/test';

const PORT = 4410;

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    // Bundled Chromium is not installed on this machine; Edge is.
    channel: process.env.PW_CHANNEL || 'msedge'
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } }
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false
  }
});
