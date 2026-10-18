import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 60_000,
  use: {
    baseURL: process.env.PRODUCTION_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  testDir: 'tests/e2e',
  reporter: 'line',
};

if (!process.env.PRODUCTION_URL) {
  config.webServer = {
    command: 'npm run build && npm run start',
    port: 3000,
    reuseExistingServer: true,
    timeout: 180_000,
  };
}

export default config;
