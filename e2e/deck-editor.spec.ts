/**
 * Конфигуратор колоды (/deck): правка карточки, превью, сохранение в браузере,
 * отмена изменений и возврат к базовой колоде с сервера. X-Lance не трогает —
 * только интерфейс и колода в localStorage тестового браузера.
 *
 *   npx playwright test e2e/deck-editor.spec.ts
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { AUTH_FILE, BASE_URL } from '../playwright.config';

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ storageState: AUTH_FILE, baseURL: BASE_URL, viewport: { width: 1500, height: 1000 } });
  page = await context.newPage();
});

test.afterAll(async () => {
  // токены обновляются по ходу — сохраняем, чтобы следующий прогон не просил входа
  await context.storageState({ path: AUTH_FILE });
  await context.close();
});

const source = () => page.getByTestId('deck-source');
const titleInput = () => page.getByLabel('Заголовок');
const previewTitle = () => page.getByTestId('card-title');

test('все карточки колоды открываются в редакторе', async () => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/deck');
  for (const team of ['catering', 'stage', 'entertainment', 'merch', 'logistics', 'afterparty']) {
    await page.getByTestId(`deck-team-${team}`).click();
    for (const round of [1, 2, 3]) {
      await page.getByTestId(`deck-round-${round}`).click();
      const title = await titleInput().inputValue();
      expect(title, `${team} · раунд ${round}`).not.toBe('');
      await expect(previewTitle()).toHaveText(title);
    }
  }
  expect(errors).toEqual([]);
});

test('правка, сохранение, отмена и возврат к базовой колоде', async () => {
  await page.goto('/deck');
  await expect(page.getByTestId('deck-editor')).toBeVisible();
  await expect(source()).toHaveText('базовая колода с сервера');

  // карточка кейтеринга, раунд 3
  await page.getByTestId('deck-team-catering').click();
  await page.getByTestId('deck-round-3').click();
  await expect(titleInput()).toHaveValue('Кофемашина сдалась первой');
  await expect(previewTitle()).toHaveText('Кофемашина сдалась первой');
  await page.waitForTimeout(800); // анимация смены карточки в превью
  await page.screenshot({ path: 'e2e/results/deck-editor.png', fullPage: true });

  // правка заголовка видна в превью, сохранение переключает игру на колоду браузера
  await titleInput().fill('Кофемашина сдалась первой (правка)');
  await expect(previewTitle()).toHaveText('Кофемашина сдалась первой (правка)');
  await page.getByTestId('deck-save').click();
  await expect(page.getByTestId('deck-message')).toContainText('сохранена');
  await expect(source()).toHaveText('колода из этого браузера (изменённая)');

  // после перезагрузки правка на месте
  await page.reload();
  await page.getByTestId('deck-team-catering').click();
  await page.getByTestId('deck-round-3').click();
  await expect(titleInput()).toHaveValue('Кофемашина сдалась первой (правка)');
  await expect(source()).toHaveText('колода из этого браузера (изменённая)');

  // действие добавляется в вариант, «Отменить изменения» его убирает
  const variantA = page.getByTestId('editor-variant-A');
  await variantA.locator('select', { hasText: '+ действие' }).selectOption({ label: 'Изменить длительность задачи' });
  await expect(page.getByTestId('action-A-0')).toBeVisible();
  await page.screenshot({ path: 'e2e/results/deck-editor-action.png', fullPage: true });
  await page.getByRole('button', { name: 'Отменить изменения' }).click();
  await expect(page.getByTestId('action-A-0')).toHaveCount(0);

  // возврат к базовой колоде с сервера
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Вернуть базовую' }).click();
  await expect(source()).toHaveText('базовая колода с сервера');
  await expect(titleInput()).toHaveValue('Кофемашина сдалась первой');
});
