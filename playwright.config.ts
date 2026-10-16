import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Proto Frontoffice.
 * Tests Web3 user journeys, navigation, responsive layouts, and wallet interactions.
 */
export default defineConfig({
  testDir: './apps/frontoffice/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // The production build served by `vite preview`: what users get, not the dev server.
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      // No Reown project id: the built-in wallet dialog opens, same locally and in CI.
      'VITE_REOWN_PROJECT_ID= bun run --filter @goton/frontoffice build && cd apps/frontoffice && bunx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
