// E2E（09 第 10.2 節）：iphone-webkit、desktop-chromium、desktop-firefox，另有 reducedMotion: 'reduce' 的專案。
// 預設對 apps/web 的 wrangler dev（重現 Workers 的 SPA fallback 與 _headers）跑；LL_E2E_BASE_URL 指向預覽網址時直接對它跑（preview.yml）。
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.LL_E2E_BASE_URL ?? 'http://127.0.0.1:8787';
const remote = !!process.env.LL_E2E_BASE_URL;

export default defineConfig({
  testDir: 'apps/web/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'zh-TW',
  },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] }, testIgnore: /reduced-motion\.spec\.ts/ },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /reduced-motion\.spec\.ts/ },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /reduced-motion\.spec\.ts/ },
    { name: 'reduced-motion', use: { ...devices['iPhone 15'], browserName: 'chromium', reducedMotion: 'reduce' }, testMatch: /reduced-motion\.spec\.ts/ },
  ],
  webServer: remote
    ? undefined
    : {
        command: 'pnpm --filter @ledgerland/web exec wrangler dev --port 8787 --ip 127.0.0.1',
        url: 'http://127.0.0.1:8787/',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
