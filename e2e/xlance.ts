/**
 * Эталон для сверки: состояние проекта так, как его считает сам X-Lance.
 * Запросы написаны здесь независимо от кода приложения; транспорт (токен и его
 * обновление) — через authGql приложения внутри страницы.
 *
 *   себестоимость = projectCost.totalPlanCost (труд по ставкам)
 *                 + projectFinance.otherExpensesPlan (исходящие платежи)
 *   доход         = projectFinance.incomePlan (входящие платежи)
 */
import type { Page } from '@playwright/test';

export interface XlTask {
  id: string;
  name: string;
  duration: number;
  startDate: string | null;
  endDate: string | null;
  assignments: { resourceId: string; planWork: number | null; units: number | null }[];
}

export interface XlPayment {
  id: string;
  name: string;
  amount: number;
  direction: 'EXPENSE' | 'INCOME';
  expenseItemId: string | null;
  planDate: string | null;
  description: string | null;
}

export interface XlSnapshot {
  labor: number;
  otherExpenses: number;
  income: number;
  /** labor + otherExpenses */
  cost: number;
  /** Окончание проекта (последняя дата окончания задачи) */
  end: string | null;
  tasks: XlTask[];
  payments: XlPayment[];
  /** id ресурса → имя */
  resources: Record<string, string>;
  /** id статьи расходов → имя */
  expenseItems: Record<string, string>;
}

/** Тенант и проект команды из результата развёртывания (localStorage приложения). */
export async function provisionedProject(page: Page, teamId: string) {
  return page.evaluate((team) => {
    const raw = localStorage.getItem('xlance-provision-v1');
    if (!raw) throw new Error('Нет результата развёртывания в localStorage');
    const result = JSON.parse(raw) as { tenantId: string; teams: { teamId: string; projectId: string }[] };
    const t = result.teams.find((x) => x.teamId === team);
    if (!t) throw new Error(`Команда ${team} не развёрнута`);
    return { tenantId: result.tenantId, projectId: t.projectId };
  }, teamId);
}

/** Снимок проекта в X-Lance; ждёт, пока X-Lance закончит пересчёт стоимости. */
export async function snapshot(page: Page, teamId: string): Promise<XlSnapshot> {
  const { tenantId, projectId } = await provisionedProject(page, teamId);
  for (let attempt = 0; attempt < 30; attempt++) {
    const data = await page.evaluate(
      async ({ t, p }) => {
        // модуль приложения в браузере (Vite): токен и его обновление
        const authStore = '/src/api/authStore.ts';
        const { authGql } = await import(/* @vite-ignore */ authStore);
        return authGql(
          `query E2ESnapshot($t: ID!, $p: ID!, $ts: String!, $tp: String!, $ps: [ID!]) {
            projectCost(input: { tenantId: $t, projectId: $p }) { totalPlanCost recalculating }
            projectFinance(input: { tenantId: $t, projectId: $p }) { incomePlan otherExpensesPlan }
            payments(input: { tenantId: $t, projectId: $p }) { id name amount direction expenseItemId planDate description }
            tasks(input: { tenantId: $t, projectId: $ps }) { id name duration startDate endDate assignments { resourceId planWork units } }
            projectResources(input: { tenantId: $ts, projectId: $tp, take: 200 }) { resourceId resource { name } }
            expenseItems(input: { tenantId: $t, includeDisabled: true }) { id name }
          }`,
          { t, p, ts: t, tp: p, ps: [p] },
        );
      },
      { t: tenantId, p: projectId },
    );
    if (!data.projectCost.recalculating) {
      const ends = (data.tasks as XlTask[]).map((x) => x.endDate?.slice(0, 10) ?? '').filter(Boolean).sort();
      const labor = data.projectCost.totalPlanCost ?? 0;
      const otherExpenses = data.projectFinance.otherExpensesPlan ?? 0;
      return {
        labor,
        otherExpenses,
        income: data.projectFinance.incomePlan ?? 0,
        cost: labor + otherExpenses,
        end: ends[ends.length - 1] ?? null,
        tasks: data.tasks,
        payments: data.payments,
        resources: Object.fromEntries(
          (data.projectResources as { resourceId: string; resource?: { name: string } }[]).map((l) => [
            l.resourceId,
            (l.resource?.name ?? '').trim(),
          ]),
        ),
        expenseItems: Object.fromEntries((data.expenseItems as { id: string; name: string }[]).map((e) => [e.id, e.name])),
      };
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error('X-Lance не закончил пересчёт стоимости проекта за 30 с');
}

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ');

export const findTask = (s: XlSnapshot, name: string) => s.tasks.find((t) => norm(t.name) === norm(name));

/** Работа ресурса на задаче, ч (0 — не назначен). */
export function workOn(s: XlSnapshot, task: string, resource: string): number | null {
  const t = findTask(s, task);
  if (!t) return null;
  const rid = Object.entries(s.resources).find(([, n]) => norm(n) === norm(resource))?.[0];
  return t.assignments.filter((a) => a.resourceId === rid).reduce((sum, a) => sum + (a.planWork ?? 0), 0);
}

export const isAssigned = (s: XlSnapshot, task: string, resource: string) => {
  const t = findTask(s, task);
  const rid = Object.entries(s.resources).find(([, n]) => norm(n) === norm(resource))?.[0];
  return Boolean(t && rid && t.assignments.some((a) => a.resourceId === rid));
};
