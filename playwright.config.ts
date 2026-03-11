import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './global-setup',
  globalTeardown: './global-teardown',
  testDir: './journeys',
  fullyParallel: false, // journeys are sequential
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // cross-service flows need sequential execution
  reporter: process.env.CI
    ? [['html'], ['github'], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : 'list',
  timeout: 60_000,

  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
