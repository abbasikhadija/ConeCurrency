import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: process.env.PLAYWRIGHT_REAL_BACKEND === '1'
        ? `../ticket-server --mode ${process.env.TEST_C_MODE || 'concurrent'} --tickets 1000 --workers 4 --queue 64 --delay-ms 0`
        : 'npm run dev:mock',
      port: 8080,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev:bridge',
      env: { ADMIN_PASSWORD: 'classroom-test-only' },
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) },
    },
  ],
});

