/**
 * Шаги игры через интерфейс — как это делает ведущий: настройка, развёртывание
 * в X-Lance (оно же сброс проекта к исходному), выбор карты и варианта, переход
 * к следующему раунду. Элементы ищутся по data-testid.
 */
import { expect, type Page } from '@playwright/test';
import type { TeamId } from '../src/data/projects';
import { PROJECTS } from '../src/data/projects';

export const TENANT = process.env.E2E_TENANT ?? 'E2E Финансы';
export const TENANT_KEY = process.env.E2E_TENANT_KEY ?? 'E2EFIN';

/** Настройка: 3 раунда, одна команда, развёртывание в X-Lance (сброс к исходному). */
export async function provisionTeam(page: Page, teamId: TeamId): Promise<void> {
  await page.goto('/setup');
  await page.getByTestId('rounds-3').click();
  for (const p of PROJECTS) {
    const toggle = page.getByTestId(`team-${p.id}`);
    const pressed = (await toggle.getAttribute('aria-pressed')) === 'true';
    if (pressed !== (p.id === teamId)) await toggle.click();
  }
  await page.getByTestId('tenant-name').fill(TENANT);
  await page.getByTestId('tenant-key').fill(TENANT_KEY);
  await page.getByTestId('provision').click();
  const result = page.getByTestId('provision-result').or(page.getByTestId('provision-error'));
  await expect(result).toBeVisible({ timeout: 5 * 60_000 });
  if (await page.getByTestId('provision-error').isVisible()) {
    throw new Error(`Развёртывание не удалось: ${await page.getByTestId('provision-error').innerText()}`);
  }
}

/** Начать игру выбранной командой. */
export async function startGame(page: Page, teamId: TeamId): Promise<void> {
  await page.getByTestId('start-game').click();
  await expect(page).toHaveURL(new RegExp(`/team/${teamId}$`));
}

export interface DecisionUi {
  /** Состояние статуса отправки: ok | failed */
  syncState: string;
  syncText: string;
  cardTitle: string;
}

/** Открыть закрытую карту, выбрать вариант и дождаться, пока решение уйдёт в X-Lance. */
export async function decide(page: Page, variantKey: string): Promise<DecisionUi> {
  await page.getByTestId('card-back').first().click();
  const variant = page.getByTestId(`variant-${variantKey}`);
  await expect(variant).toBeVisible();
  const cardTitle = (await page.getByTestId('card-title').innerText()).trim();
  await variant.click();
  await expect(page.getByTestId('decision-done')).toBeVisible();
  const status = page.getByTestId('sync-status');
  await expect(status).toHaveAttribute('data-state', /^(ok|failed)$/, { timeout: 3 * 60_000 });
  return {
    syncState: (await status.getAttribute('data-state')) ?? '',
    syncText: (await status.innerText()).trim(),
    cardTitle,
  };
}

/** Закончить раунд одной командой и перейти к следующему. */
export async function nextRound(page: Page, teamId: TeamId): Promise<void> {
  await page.getByTestId('next-step').click();
  await expect(page).toHaveURL(/\/round$/);
  await page.getByTestId('round-next').click();
  await expect(page).toHaveURL(new RegExp(`/team/${teamId}$`));
}
