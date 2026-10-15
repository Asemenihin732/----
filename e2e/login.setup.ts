/**
 * Вход в X-Lance для e2e: тест открывает страницу входа в видимом Chrome и ждёт,
 * пока человек сам войдёт. Пароль тест не знает и не вводит — сохраняется только
 * сессия (токены) в e2e/.auth/user.json.
 */
import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AUTH_FILE } from '../playwright.config';

test('вход в X-Lance (вручную)', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  await page.goto('/login');
  console.log('\n→ В открывшемся окне Chrome войдите своей учётной записью X-Lance.\n');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15 * 60_000 });
  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`Сессия сохранена: ${AUTH_FILE}`);
});
