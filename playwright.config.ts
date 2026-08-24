import { defineConfig, devices } from '@playwright/test';
import { loadAppEnv } from './e2e/helpers/loadAppEnv';

const PORT = 19006;
const BASE_URL = `http://localhost:${PORT}`;
const appEnv = loadAppEnv();

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    // Failure evidence for CI artifacts (uploaded by e2e.yml).
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx expo start --web --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      ...appEnv,
      EXPO_PUBLIC_E2E: '1',
      EXPO_PUBLIC_E2E_STUB_API: '1',
    },
  },
});
