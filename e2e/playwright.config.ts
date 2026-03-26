import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// Storage state written by global-setup.ts; loaded by the authedPage fixture.
export const AUTH_FILE = path.join(__dirname, '.auth/admin.json');

export default defineConfig({
  globalSetup: require.resolve('./global-setup'),

  testDir: './tests',
  fullyParallel: false,      // run sequentially to avoid state conflicts
  retries: 1,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  timeout: 60000,
  expect: { timeout: 12000 },

  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 12000,
    navigationTimeout: 60000,
    // Vite dev-server loads many ES modules; wait only for DOMContentLoaded
    // instead of the full 'load' event to avoid HMR-WebSocket delays
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        },
      },
    },
  ],
});
