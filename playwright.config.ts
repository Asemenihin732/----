/**
 * E2E-тесты финансов игры против живого X-Lance (dev-стенд из .env).
 *
 *   npm run e2e:login   — один раз: откроется Chrome, войдите своей учётной записью;
 *                         сессия сохранится в e2e/.auth/user.json (в git не попадает).
 *   npm run e2e         — все команды × раунды × варианты; отчёт: e2e/results/.
 *
 * Фильтры: E2E_TEAMS=stage,merch  E2E_ROUNDS=1,2  E2E_VARIANTS=A
 * Тенант:  E2E_TENANT="E2E Финансы"  E2E_TENANT_KEY=E2EFIN
 */
import { defineConfig } from '@playwright/test';

const PORT = 5180;
export const BASE_URL = `http://localhost:${PORT}`;
export const AUTH_FILE = 'e2e/.auth/user.json';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  outputDir: 'e2e/results/artifacts',
  // Тесты идут по одному: общий тенант X-Lance и одна сессия входа
  // (refresh-токен меняется при обновлении — параллельные воркеры его бы ломали).
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 10 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { outputFolder: 'e2e/results/html', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    channel: 'chrome', // установленный Chrome — браузеры Playwright скачивать не нужно
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: 'login',
      testMatch: /login\.setup\.ts/,
      use: { headless: false },
    },
    {
      name: 'finance',
      testMatch: /\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --open false`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
