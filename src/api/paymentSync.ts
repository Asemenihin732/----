/**
 * paymentSync.ts — платежи игры в X-Lance.
 *
 * Базовые платежи (при развёртывании, `createBasePayments`) — из плана работ
 * (X-Lance_Plany_rabot.xlsx): исходящий платёж на каждый отдельный расход задачи
 * и входящий «Оплата по договору» на доход проекта.
 *
 * Платежи по карточке (`syncCardPayments`) — из колоды (`variant.payments`):
 * знак суммы задаёт направление — минус исходящий платёж, плюс входящий;
 * `reduce` — сокращение расхода подрядчика/материала: уменьшаем сумму
 * исходящего платежа по статье. Экономия на штатном сотруднике — не платёж,
 * а уменьшение его трудозатрат (действие `labor`, см. taskActions.ts).
 * Входящие платежи — только доход.
 *
 *   • тип платежа      — тип объекта тенанта с нужным `paymentDirection`;
 *                        если типа нет или он выключен — включаем/создаём
 *                        по образцу типа противоположного направления;
 *   • статья расходов  — ищется по имени, при отсутствии создаётся;
 *   • плановая дата    — см. cardPaymentDate: расход — на дату связанной задачи
 *                        или базового платежа той же статьи, доход — на окончание проекта;
 *   • повторы          — платёж с тем же названием и описанием не дублируется.
 */
import { loadProvisionResult } from './provision';
import {
  createExpenseItem,
  createObjectType,
  createPayment,
  deletePayment,
  updatePayment,
  enableObjectType,
  expenseItems,
  payments as fetchPayments,
  tasks as fetchTasks,
  paymentTypes,
  pickPaymentType,
  type ExpenseItemInfo,
  type ObjectTypeInfo,
  type PaymentDirection,
  type PaymentInfo,
  type TaskInfo,
} from './graphqlApi';
import { formatMoney } from '../game/engine';
import { BASE_PAYMENT_PREFIX, cardPaymentDate } from './paymentRules';

export { BASE_PAYMENT_PREFIX, cardPaymentDate };
import { getProject, type TeamId } from '../data/projects';
import { getPlan } from '../data/plan';
import type { Card, CardPayment, Variant } from '../game/types';

export interface PaymentSyncResult {
  payment: CardPayment;
  direction: PaymentDirection;
  ok: boolean;
  /** Платёж уже был внесён ранее — повторно не создавался */
  skipped?: boolean;
  paymentId?: string;
  error?: string;
}

/** Направление платежа по знаку суммы; сокращение расхода меняет исходящий платёж. */
export const paymentDirection = (amount: number, reduce = false): PaymentDirection =>
  reduce || amount < 0 ? 'EXPENSE' : 'INCOME';

const normalize = (name: string): string =>
  name.trim().toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ');

const toDate = (value?: string | null): string | undefined => value?.slice(0, 10) || undefined;

/** Статьи расходов тенанта (кэш на время сессии вкладки). */
const expenseItemCache = new Map<string, Promise<ExpenseItemInfo[]>>();

export async function ensureExpenseItem(tenantId: string, name: string): Promise<string> {
  if (!expenseItemCache.has(tenantId)) {
    const request = expenseItems(tenantId);
    request.catch(() => expenseItemCache.delete(tenantId)); // не кэшируем ошибку
    expenseItemCache.set(tenantId, request);
  }
  const list = await expenseItemCache.get(tenantId)!;
  const found = list.find((item) => normalize(item.name) === normalize(name));
  if (found) return found.id;
  const created = await createExpenseItem(tenantId, name);
  list.push(created);
  return created.id;
}

const PAYMENT_TYPE_NAMES: Record<PaymentDirection, string> = {
  EXPENSE: 'Исходящий платёж',
  INCOME: 'Входящий платёж',
};

/**
 * Тип объекта для платежей нужного направления. В тенанте по умолчанию может
 * быть только один из двух типов (например, лишь исходящий) — тогда второй
 * включаем, если он выключен, или создаём по образцу существующего.
 */
export async function ensurePaymentType(
  tenantId: string,
  direction: PaymentDirection,
  known?: ObjectTypeInfo[],
): Promise<ObjectTypeInfo> {
  const types = known ?? (await paymentTypes(tenantId));
  const enabled = pickPaymentType(types, direction);
  if (enabled) return enabled;

  const sameDirection = (t: ObjectTypeInfo) => t.paymentDirection?.toUpperCase() === direction;
  const disabled = types.find(sameDirection);
  if (disabled) return enableObjectType(tenantId, disabled.id);

  const template = types.find((t) => t.paymentDirection && !sameDirection(t));
  if (!template) {
    const kind = direction === 'EXPENSE' ? 'исходящих' : 'входящих';
    throw new Error(`В тенанте нет типов объектов для платежей — не из чего создать тип ${kind} платежей`);
  }
  return createObjectType({
    tenantId,
    name: PAYMENT_TYPE_NAMES[direction],
    objectClass: template.objectClass,
    startStatusId: template.startStatusId,
    paymentDirection: direction,
    isScheduled: template.isScheduled,
  });
}

/** Удалить все платежи проекта — возврат к исходному состоянию перед игрой. */
export async function clearProjectPayments(tenantId: string, projectId: string): Promise<number> {
  const list = await fetchPayments(tenantId, projectId);
  for (const payment of list) await deletePayment(tenantId, payment.id);
  return list.length;
}

export const CONTRACT_PAYMENT_NAME = 'Оплата по договору';

/**
 * Создать базовые платежи проекта по плану работ: исходящий платёж на каждый
 * отдельный расход задачи (статья = название расхода, дата = начало задачи)
 * и входящий «Оплата по договору» на доход проекта (дата = окончание проекта).
 * Вызывается после сброса платежей, поэтому повторы не проверяет.
 */
export async function createBasePayments(params: {
  tenantId: string;
  teamId: TeamId;
  projectId: string;
  /** Задачи проекта в X-Lance — для плановых дат платежей */
  tasks: TaskInfo[];
}): Promise<PaymentInfo[]> {
  const { tenantId, teamId, projectId, tasks } = params;
  const plan = getPlan(teamId);
  const types = await paymentTypes(tenantId);
  const expenseType = await ensurePaymentType(tenantId, 'EXPENSE', types);
  const incomeType = await ensurePaymentType(tenantId, 'INCOME', types);
  const taskByName = new Map(tasks.map((t) => [normalize(t.name), t]));

  const created: PaymentInfo[] = [];
  for (const task of plan.tasks) {
    const info = taskByName.get(normalize(task.name));
    for (const expense of task.expenses) {
      created.push(
        await createPayment({
          tenantId,
          projectId,
          objectTypeId: expenseType.id,
          name: expense.item,
          amount: expense.amount,
          description: `${BASE_PAYMENT_PREFIX} · задача «${task.name}»`,
          expenseItemId: await ensureExpenseItem(tenantId, expense.item),
          planDate: toDate(info?.startDate),
        }),
      );
    }
  }

  const projectEnd = tasks.map((t) => t.endDate ?? '').sort().pop();
  created.push(
    await createPayment({
      tenantId,
      projectId,
      objectTypeId: incomeType.id,
      name: CONTRACT_PAYMENT_NAME,
      amount: getProject(teamId).baseIncome,
      description: `${BASE_PAYMENT_PREFIX} · доход по договору`,
      planDate: toDate(projectEnd),
    }),
  );
  return created;
}

/**
 * Платежи варианта: из колоды, а если вариант их не описывает (карточка не из
 * колоды) — из его денежных изменений, чтобы ни один денежный пункт не потерялся.
 * Сокращение расхода без статьи внести нельзя — оно вернётся ошибкой.
 */
export function cardPayments(card: Card, variant: Variant): CardPayment[] {
  if (variant.payments) return variant.payments;
  const name = `${card.title}: ${variant.label}`;
  const list: CardPayment[] = [];
  const cost = variant.deltaCost ?? 0;
  const revenue = variant.deltaRevenue ?? 0;
  if (cost > 0) list.push({ name, amount: -cost });
  if (cost < 0) list.push({ name: `Сокращение расходов: ${name}`, amount: -cost, reduce: true });
  if (revenue > 0) list.push({ name, amount: revenue });
  return list;
}

/** Описание платежа: откуда он взялся (по нему же отсекаются повторы). */
export function paymentDescription(card: Card, variant: Variant, round: number): string {
  return `Раунд ${round} · карточка «${card.title}» · вариант ${variant.key} — ${variant.label}`;
}

/** Внести в X-Lance платежи выбранного варианта карточки. */
export async function syncCardPayments(params: {
  teamId: TeamId;
  card: Card;
  variant: Variant;
  round: number;
  /** Какие платежи вносить (по умолчанию — все платежи варианта) */
  payments?: CardPayment[];
}): Promise<PaymentSyncResult[]> {
  const list = params.payments ?? cardPayments(params.card, params.variant);
  if (list.length === 0) return [];

  const fail = (error: string): PaymentSyncResult[] =>
    list.map((payment) => ({
      payment,
      direction: paymentDirection(payment.amount, payment.reduce),
      ok: false,
      error,
    }));

  const provision = loadProvisionResult();
  const team = provision?.teams.find((t) => t.teamId === params.teamId);
  if (!provision || !team) return fail('Игра не развёрнута в X-Lance — нет данных провижининга');

  const { tenantId } = provision;
  // задачи читаем после действий решения: новая задача карточки уже создана
  const [types, existing, taskList] = await Promise.all([
    paymentTypes(tenantId),
    fetchPayments(tenantId, team.projectId),
    fetchTasks(tenantId, team.projectId),
  ]);
  const description = paymentDescription(params.card, params.variant, params.round);

  const typeByDirection = new Map<PaymentDirection, Promise<ObjectTypeInfo>>();
  const typeFor = (direction: PaymentDirection) => {
    if (!typeByDirection.has(direction)) typeByDirection.set(direction, ensurePaymentType(tenantId, direction, types));
    return typeByDirection.get(direction)!;
  };

  const results: PaymentSyncResult[] = [];
  for (const payment of list) {
    const direction = paymentDirection(payment.amount, payment.reduce);
    try {
      if (payment.reduce) {
        results.push({ payment, direction, ...(await reduceExpense(tenantId, existing, payment, description)) });
        continue;
      }

      const duplicate = existing.find(
        (p) =>
          p.direction === direction &&
          normalize(p.name) === normalize(payment.name) &&
          (p.description ?? '') === description,
      );
      if (duplicate) {
        results.push({ payment, direction, ok: true, skipped: true, paymentId: duplicate.id });
        continue;
      }

      const type = await typeFor(direction);

      const created = await createPayment({
        tenantId,
        projectId: team.projectId,
        objectTypeId: type.id,
        name: payment.name,
        amount: Math.abs(payment.amount),
        description,
        expenseItemId:
          direction === 'EXPENSE' && payment.expenseItem
            ? await ensureExpenseItem(tenantId, payment.expenseItem)
            : undefined,
        planDate: cardPaymentDate({
          direction,
          variant: params.variant,
          expenseItemId: payment.expenseItem ? await ensureExpenseItem(tenantId, payment.expenseItem) : undefined,
          tasks: taskList,
          payments: existing,
        }),
      });
      results.push({ payment, direction, ok: true, paymentId: created.id });
    } catch (error) {
      results.push({
        payment,
        direction,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

/**
 * Сокращение расхода: уменьшить сумму исходящего платежа по статье
 * (сначала базового, иначе любого с этой статьёй) на сумму из карточки.
 * Отметка о сокращении дописывается в описание платежа — по ней повтор пропускается.
 */
async function reduceExpense(
  tenantId: string,
  existing: PaymentInfo[],
  payment: CardPayment,
  description: string,
): Promise<Omit<PaymentSyncResult, 'payment' | 'direction'>> {
  const item = payment.expenseItem ?? '';
  if (!item) throw new Error('Сокращение расхода без статьи — не к чему применить, укажите статью в колоде');
  const itemId = await ensureExpenseItem(tenantId, item);
  const candidates = existing
    .filter(
      (p) =>
        p.direction === 'EXPENSE' &&
        (p.expenseItemId === itemId || normalize(p.name) === normalize(item)),
    )
    .sort(
      (a, b) =>
        Number((b.description ?? '').startsWith(BASE_PAYMENT_PREFIX)) -
          Number((a.description ?? '').startsWith(BASE_PAYMENT_PREFIX)) || b.amount - a.amount,
    );

  const already = candidates.find((p) => (p.description ?? '').includes(description));
  if (already) return { ok: true, skipped: true, paymentId: already.id };

  const target = candidates[0];
  if (!target) {
    throw new Error(
      `Нет исходящего платежа по статье «${item}». Если это штатный сотрудник — сокращайте его трудозатраты (действие labor)`,
    );
  }

  const amount = Math.max(0, target.amount - Math.abs(payment.amount));
  const note = `Сокращено на ${formatMoney(Math.abs(payment.amount))}: ${description}`;
  const updated = await updatePayment({
    tenantId,
    id: target.id,
    amount,
    description: [target.description, note].filter(Boolean).join('\n'),
  });
  return { ok: true, paymentId: updated.id };
}
