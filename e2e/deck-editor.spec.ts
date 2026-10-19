/**
 * Конфигуратор колоды (/deck): правка карточки, превью, сохранение в браузере,
 * отмена изменений и возврат к базовой колоде с сервера. X-Lance не трогает —
 * только интерфейс и колода в localStorage тестового браузера.
 *
 *   npx playwright test e2e/deck-editor.spec.ts
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
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

test('автоподсчёт последствий и запрет сохранения с ошибками', async () => {
  await page.goto('/deck');
  await expect(page.getByTestId('deck-check')).toContainText('замечаний нет');
  await page.getByTestId('deck-team-catering').click();
  await page.getByTestId('deck-round-1').click();

  // сумма платежа изменилась — карточка расходится с расчётом, «Подставить расчёт» чинит
  await page.getByTestId('payment-C-0').locator('input[type=number]').fill('12000');
  await expect(page.getByTestId('apply-calc-C')).toBeVisible();
  await expect(page.getByTestId('deck-check')).toContainText('предупреждений 1');
  await page.getByTestId('apply-calc-C').click();
  await expect(page.getByTestId('calc-C')).toContainText('совпадает с карточкой');
  await expect(page.getByTestId('consequences-C')).toContainText('+12 000 ₽ расход');

  // ошибка (вариант без названия) — сохранить нельзя
  await page.getByTestId('editor-variant-A').getByLabel('Название варианта').fill('');
  await expect(page.getByTestId('issues-A')).toContainText('нет названия варианта');
  await expect(page.getByTestId('deck-check')).toContainText('ошибок 1');
  await page.screenshot({ path: 'e2e/results/deck-editor-check.png', fullPage: true });
  await page.getByTestId('deck-save').click();
  await expect(page.getByTestId('deck-message')).toContainText('Не сохранено');
  await expect(source()).toHaveText('базовая колода с сервера');

  await page.getByRole('button', { name: 'Отменить изменения' }).click();
  await expect(page.getByTestId('deck-check')).toContainText('замечаний нет');
});

test('колода файлом: скачать, загрузить, битый файл', async () => {
  await page.goto('/deck');

  // скачанный deck.json — та же колода, в формате файла
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('deck-download').click()]);
  expect(download.suggestedFilename()).toBe('deck.json');
  const file = JSON.parse(readFileSync(await download.path(), 'utf8')) as { version: number; cards: { team: string; round: number; title: string }[] };
  expect(file.version).toBe(1);
  expect(file.cards).toHaveLength(18);

  // изменённый файл загружается в редактор, сохраняется отдельной кнопкой
  const changed = structuredClone(file);
  changed.cards.find((c) => c.team === 'merch' && c.round === 2)!.title = 'Логотип из файла';
  await page.getByTestId('deck-upload').setInputFiles({
    name: 'my-deck.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(changed)),
  });
  await expect(page.getByTestId('deck-message')).toContainText('Загружено из «my-deck.json»: карточек 18');
  await page.getByTestId('deck-team-merch').click();
  await page.getByTestId('deck-round-2').click();
  await expect(titleInput()).toHaveValue('Логотип из файла');
  await expect(source()).toHaveText('базовая колода с сервера'); // ещё не сохранено

  // битый файл не принимается, правки в редакторе остаются
  // (правки не сохранены — редактор спрашивает, заменить ли их; соглашаемся)
  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('deck-upload').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version": 1, "cards": [{"team": "космос"}]}'),
  });
  await expect(page.getByTestId('deck-message')).toContainText('Файл не подошёл');
  await expect(titleInput()).toHaveValue('Логотип из файла');

  await page.getByRole('button', { name: 'Отменить изменения' }).click();
  await expect(titleInput()).toHaveValue('Заказчик поменял логотип');
});
