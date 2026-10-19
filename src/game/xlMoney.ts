/**
 * xlMoney.ts — сколько денег решение по карточке должно изменить в X-Lance.
 *
 * Расход = исходящие платежи − сокращения платежей + труд по ставкам плана
 * (трудозатраты, переназначения, длительность задач, исполнители новых задач). Доход = входящие
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
  'merch:1:B': 'ушедший дизайнер больше не оплачивается (−14 000), менеджер доделывает за добавленный день',
};

/** Ожидаемое изменение денег в X-Lance от варианта решения команды. */
export function xlMoneyOf(teamId: TeamId, variant: Pick<Variant, 'payments' | 'actions'>): XlMoney {
  const plan = getPlan(teamId);
  const rate = (name: string) => plan.resources.find((r) => r.name === name && r.kind === 'HUMAN')?.ratePerDay ?? 0;

  // Состояние задач по ходу действий варианта: длительность и работа исполнителей, чел.-дн.
  const state = new Map<string, { duration: number; work: Map<string, number> }>();
  const taskOf = (name: string) => {
    let t = state.get(name);
    if (!t) {
      const p = plan.tasks.find((x) => x.name === name);
      t = { duration: p?.durationDays ?? 0, work: new Map(p?.assignments.map((a) => [a.resource, a.days])) };
      state.set(name, t);
    }
    return t;
  };

  let cost = 0;
  let income = 0;
  for (const p of variant.payments ?? []) {
    if (p.reduce) cost -= p.amount;
    else if (p.amount < 0) cost += -p.amount;
    else income += p.amount;
  }
  for (const a of variant.actions ?? []) {
    if (a.type === 'labor') {
      const t = taskOf(a.task);
      const work = (t.work.get(a.resource) ?? 0) + a.days;
      cost += rate(a.resource) * a.days;
      if (work > 0) t.work.set(a.resource, work);
      else t.work.delete(a.resource);
    }
    if (a.type === 'reassign') {
      const t = taskOf(a.task);
      const moved = t.work.get(a.from) ?? 0;
      cost += (rate(a.to) - rate(a.from)) * moved;
      t.work.delete(a.from);
      t.work.set(a.to, (t.work.get(a.to) ?? 0) + moved);
    }
    // длительность меняется с сохранением загрузки — работа и стоимость растут вместе со сроком
    if (a.type === 'duration') {
      const t = taskOf(a.task);
      const next = Math.max(0.5, t.duration + a.days);
      for (const [resource, work] of t.work) {
        const extra = t.duration > 0 ? (work / t.duration) * (next - t.duration) : 0;
        cost += rate(resource) * extra;
        t.work.set(resource, work + extra);
      }
      t.duration = next;
    }
    if (a.type === 'addTask') {
      state.set(a.name, { duration: a.days, work: new Map((a.assign ?? []).map((x) => [x.resource, x.days])) });
      for (const x of a.assign ?? []) cost += rate(x.resource) * x.days;
    }
  }
  return { cost, income };
}

/** Изменение денег по карточке (то, что видит игра). */
export const cardMoneyOf = (variant: Variant): XlMoney => ({
  cost: variant.deltaCost ?? 0,
  income: variant.deltaRevenue ?? 0,
});
