import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:1431/xtools-market/',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --outDir _site --base /xtools-market/ --host 127.0.0.1 --port 1431 --strictPort',
    url: 'http://127.0.0.1:1431/xtools-market/',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
