import { defineConfig } from '@playwright/test';
const development = process.env.PREVIEW_TEST_DEV === '1';
export default defineConfig({
  testDir: './tests/browser', testMatch: development ? 'development.spec.js' : 'acceptance.spec.js', timeout: 90000, workers: 1, reporter: 'list',
  outputDir: 'data/.test-playwright-results',
  use: { baseURL: 'http://localhost:3103', actionTimeout: 10000, headless: true, viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `node tests/preview.mjs${development ? ' --dev' : ''}`, url: 'http://localhost:3103/api/health', env: { PREVIEW_TEST_PORT: '3103' }, reuseExistingServer: false, timeout: 30000 }
});
