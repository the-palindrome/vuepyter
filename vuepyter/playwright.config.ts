import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IS_CI = Boolean(process.env.CI)
const REUSE_E2E_SERVER = process.env.PW_REUSE_E2E_SERVER === '1'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  fullyParallel: false,
  retries: IS_CI ? 2 : 0,
  workers: 1,
  reporter: IS_CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    navigationTimeout: 60000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Video capture spawns ffmpeg workers and can exhaust thread-constrained
    // CI/dev environments, causing false navigation timeouts.
    video: 'off',
    viewport: { width: 1440, height: 1200 },
    launchOptions: {
      // Keep Chromium process/thread footprint small for constrained runners.
      args: ['--renderer-process-limit=1'],
    },
  },
  webServer: {
    command: 'npm run e2e:dev',
    url: 'http://127.0.0.1:4173',
    // Default to a fresh server per run to avoid stale-process reuse flakes.
    reuseExistingServer: !IS_CI && REUSE_E2E_SERVER,
    timeout: 180000,
    env: {
      ...process.env,
      UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE ?? '1',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
