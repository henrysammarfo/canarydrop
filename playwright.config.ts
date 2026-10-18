import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 60_000,
  webServer: {
    command: 'npm run build && npm run start',
    port: 3000,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  testDir: 'tests/e2e',
  reporter: 'line',
};
export default config;

