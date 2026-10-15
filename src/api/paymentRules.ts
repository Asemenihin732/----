/**
 * paymentRules.ts — чистые правила платежей (без обращений к API): их используют
 * и синхронизация с X-Lance, и тесты как эталон.
 */
import type { PaymentDirection, PaymentInfo, TaskInfo } from './graphqlApi';
import type { Variant } from '../game/types';

/** Начало описания базовых платежей (из плана работ). */
export const BASE_PAYMENT_PREFIX = 'Базовый план';

const normalize = (name: string): string =>
  name.trim().toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ');

const toDate = (value?: string | null): string | undefined => value?.slice(0, 10) || undefined;

/**
 * Плановая дата платежа по карточке:
 *   • входящий — окончание проекта;
 *   • исходящий — начало задачи, которую решение создаёт или меняет
 *     (новая задача → длительность/трудозатраты/исполнитель), иначе дата
 *     базового платежа той же статьи, иначе начало проекта.
 */
export function cardPaymentDate(params: {
  direction: PaymentDirection;
  variant: Variant;
  expenseItemId?: string;
  tasks: TaskInfo[];
  payments: PaymentInfo[];
}): string | undefined {
  const { tasks } = params;
  const starts = tasks.map((t) => toDate(t.startDate)).filter(Boolean).sort() as string[];
  const ends = tasks.map((t) => toDate(t.endDate)).filter(Boolean).sort() as string[];
  if (params.direction === 'INCOME') return ends[ends.length - 1];

  const startOf = (name: string) => toDate(tasks.find((t) => normalize(t.name) === normalize(name))?.startDate);
  const actions = params.variant.actions ?? [];
  for (const a of actions) if (a.type === 'addTask' && startOf(a.name)) return startOf(a.name);
  for (const a of actions) {
    if ((a.type === 'duration' || a.type === 'labor' || a.type === 'reassign') && startOf(a.task)) return startOf(a.task);
  }
  if (params.expenseItemId) {
    const base = params.payments.find(
      (p) =>
        p.direction === 'EXPENSE' &&
        p.expenseItemId === params.expenseItemId &&
        (p.description ?? '').startsWith(BASE_PAYMENT_PREFIX),
    );
    if (base?.planDate) return toDate(base.planDate);
  }
  return starts[0];
}

