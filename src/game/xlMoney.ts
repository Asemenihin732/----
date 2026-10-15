/**
 * xlMoney.ts — сколько денег решение по карточке должно изменить в X-Lance.
 *
 * Расход = исходящие платежи − сокращения платежей + труд по ставкам плана
 * (трудозатраты, переназначения, исполнители новых задач). Доход = входящие
 * платежи. Это ожидание, с которым сверяются unit-тесты колоды и e2e-тесты
 * против живого X-Lance (projectCost + projectFinance).
 */
import { getPlan } from '../data/plan';
import type { TeamId } from '../data/projects';
import type { Variant } from './types';

export interface XlMoney {
  /** Изменение себестоимости проекта, ₽ (труд + исходящие платежи) */
  cost: number;
  /** Изменение дохода проекта, ₽ (входящие платежи) */
  income: number;
}

/**
 * Принятые расхождения X-Lance с числами карточки: в X-Lance честная стоимость,
 * в игре — числа с карточки. Ключ — `${team}:${round}:${variant}`.
 */
export const ACCEPTED_GAPS: Record<string, string> = {
  'merch:1:A': 'ушедший дизайнер больше не оплачивается (−14 000), фрилансер — платёж 40 000',
  'merch:1:B': 'день дизайнера (14 000) переходит менеджеру (15 000): +1 000 сверх «Переработок»',
};

/** Ожидаемое изменение денег в X-Lance от варианта решения команды. */
export function xlMoneyOf(teamId: TeamId, variant: Variant): XlMoney {
  const plan = getPlan(teamId);
  const rate = (name: string) => plan.resources.find((r) => r.name === name && r.kind === 'HUMAN')?.ratePerDay ?? 0;
  const workOf = (task: string, resource: string) =>
    plan.tasks.find((t) => t.name === task)?.assignments.find((a) => a.resource === resource)?.days ?? 0;

  let cost = 0;
  let income = 0;
  for (const p of variant.payments ?? []) {
    if (p.reduce) cost -= p.amount;
    else if (p.amount < 0) cost += -p.amount;
    else income += p.amount;
  }
  for (const a of variant.actions ?? []) {
    if (a.type === 'labor') cost += rate(a.resource) * a.days;
    if (a.type === 'reassign') cost += (rate(a.to) - rate(a.from)) * workOf(a.task, a.from);
    if (a.type === 'addTask') for (const x of a.assign ?? []) cost += rate(x.resource) * x.days;
  }
  return { cost, income };
}

/** Изменение денег по карточке (то, что видит игра). */
export const cardMoneyOf = (variant: Variant): XlMoney => ({
  cost: variant.deltaCost ?? 0,
  income: variant.deltaRevenue ?? 0,
});
