/**
 * deckCheck.ts — автоподсчёт последствий варианта и проверка колоды.
 * Используют конфигуратор (/deck) и unit-тесты; правила — те же, по которым
 * игра выполняет решение в X-Lance (xlMoney.ts, taskActions.ts).
 */
import type { DeckEntry, DeckVariant } from '../data/deck';
import { getPlan } from '../data/plan';
import { getProject, type TeamId } from '../data/projects';
import { ACCEPTED_GAPS, xlMoneyOf } from './xlMoney';
import type { RoundNumber, VariantKey } from './types';

/** Последствия варианта, посчитанные из его действий и платежей. */
export interface VariantCalc {
  /** Сдвиг срока проекта, дн. — оценка: длительности, задачи «перед», продление */
  days: number;
  /** Расход в X-Lance, ₽ (платежи + труд по ставкам плана) */
  cost: number;
  /** Из расхода — труд, ₽ */
  labor: number;
  /** Доход, ₽ */
  income: number;
}

export function calcVariant(team: TeamId, v: DeckVariant): VariantCalc {
  const money = xlMoneyOf(team, v);
  let paymentsCost = 0;
  for (const p of v.payments ?? []) {
    if (p.reduce) paymentsCost -= p.amount;
    else if (p.amount < 0) paymentsCost += -p.amount;
  }
  let days = 0;
  for (const a of v.actions ?? []) {
    if (a.type === 'duration' || a.type === 'extendProject') days += a.days;
    if (a.type === 'addTask' && a.placement === 'before') days += a.days;
  }
  return { days, cost: money.cost, labor: money.cost - paymentsCost, income: money.income };
}

/** Последствия на карточке (то, что видит игра). */
export function cardConsequences(v: DeckVariant): VariantCalc {
  return {
    days: v.deltaDays?.deltaDay ?? 0,
    cost: v.deltaCost ?? 0,
    labor: v.laborCost ?? 0,
    income: v.deltaRevenue ?? 0,
  };
}

export interface DeckIssue {
  /** error — сохранить нельзя; warning — можно, но стоит посмотреть */
  level: 'error' | 'warning';
  team: TeamId;
  round?: RoundNumber;
  variant?: VariantKey;
  text: string;
}

const rub = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ru-RU').replace(/\s/g, ' ')} ₽`;

/** Проверить колоду целиком: по карточке на раунд, ссылки на план и бюджет, деньги. */
export function checkDeck(entries: DeckEntry[]): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const teams = [...new Set(entries.map((e) => e.team))];
  const allTeams: TeamId[] = ['catering', 'stage', 'entertainment', 'merch', 'logistics', 'afterparty'];

  for (const team of allTeams) {
    for (const round of [1, 2, 3] as RoundNumber[]) {
      const n = entries.filter((e) => e.team === team && e.round === round).length;
      if (n === 0) issues.push({ level: 'error', team, round, text: `нет карточки на раунд ${round}` });
      if (n > 1) issues.push({ level: 'error', team, round, text: `${n} карточки на раунд ${round} — нужна одна` });
    }
  }
  for (const team of teams) if (!allTeams.includes(team)) issues.push({ level: 'error', team, text: 'неизвестная команда' });

  for (const e of entries) issues.push(...checkEntry(e));
  return issues;
}

/** Проверить одну карточку. */
export function checkEntry(e: DeckEntry): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const { team, round } = e;
  const add = (level: DeckIssue['level'], text: string, variant?: VariantKey) =>
    issues.push({ level, team, round, variant, text });

  const plan = getPlan(team);
  const planTasks = new Set(plan.tasks.map((t) => t.name));
  const people = new Set(plan.resources.filter((r) => r.kind === 'HUMAN').map((r) => r.name));
  const budget = new Set(getProject(team).budget.map((b) => b.item));

  if (!e.title.trim()) add('error', 'нет заголовка');
  if (!e.description.trim()) add('warning', 'нет описания ситуации');

  const keys = (Object.keys(e.variants) as VariantKey[]).filter((k) => e.variants[k]);
  if (e.bonus && (keys.length !== 1 || keys[0] !== 'A')) add('error', 'у бонусной карточки один вариант — A «Принять»');
  if (!e.bonus && keys.join('') !== 'ABC') add('error', 'нужны три варианта: A, B и C');

  for (const key of keys) {
    const v = e.variants[key]!;
    const err = (text: string) => add('error', text, key);
    const warn = (text: string) => add('warning', text, key);

    if (!v.label.trim()) err('нет названия варианта');
    if (!v.steps.some((s) => s.trim())) warn('нет текста шагов «Что сделать в X-Lance»');

    const added = new Set<string>();
    const needTask = (name: string, what: string) => {
      if (!name.trim()) err(`${what}: не выбрана задача`);
      else if (!planTasks.has(name) && !added.has(name)) err(`${what}: задачи «${name}» нет в плане команды`);
    };
    const needPerson = (name: string, what: string) => {
      if (!name.trim()) err(`${what}: не выбран человек`);
      else if (!people.has(name)) err(`${what}: «${name}» нет в плане команды`);
    };
    for (const a of v.actions ?? []) {
      switch (a.type) {
        case 'duration':
          needTask(a.task, 'длительность');
          if (!a.days) err(`длительность «${a.task}»: 0 дней`);
          break;
        case 'extendProject':
          if (!a.days) err('продление проекта: 0 дней');
          break;
        case 'addTask':
          if (!a.name.trim()) err('новая задача без названия');
          else if (planTasks.has(a.name)) err(`новая задача «${a.name}» уже есть в плане`);
          if (!Number.isInteger(a.days) || a.days < 1) err(`«${a.name}»: длительность — целое число дней от 1`);
          if (!planTasks.has(a.anchor)) err(`«${a.name}»: задачи-якоря «${a.anchor}» нет в плане`);
          for (const x of a.assign ?? []) needPerson(x.resource, `«${a.name}»`);
          added.add(a.name);
          break;
        case 'labor':
          needTask(a.task, 'трудозатраты');
          needPerson(a.resource, 'трудозатраты');
          if (!a.days) err(`трудозатраты «${a.resource}»: 0 чел.-дней`);
          break;
        case 'reassign':
          needTask(a.task, 'переназначение');
          needPerson(a.from, 'переназначение');
          if (!a.to.trim()) err('переназначение: не указано, на кого');
          if (a.to === a.from) err('переназначение: на того же человека');
          break;
        case 'manual':
          if (!a.text.trim()) err('ручной шаг без текста');
          break;
      }
    }

    for (const p of v.payments ?? []) {
      const name = p.name.trim() || 'без названия';
      if (!p.name.trim()) err('платёж без названия');
      if (!p.amount) err(`платёж «${name}»: сумма 0`);
      if (p.reduce && !p.expenseItem) err(`сокращение «${name}»: не выбрана статья`);
      if (p.expenseItem && !budget.has(p.expenseItem)) err(`платёж «${name}»: статьи «${p.expenseItem}» нет в бюджете`);
    }

    // последствия на карточке против расчёта по действиям
    const calc = calcVariant(team, v);
    const card = cardConsequences(v);
    const gap = ACCEPTED_GAPS[`${team}:${round}:${key}`];
    if (gap) continue;
    if (card.cost !== calc.cost) warn(`расход на карточке ${rub(card.cost)}, по действиям ${rub(calc.cost)}`);
    // пометка «в т. ч. труд» необязательна: сверяем, только если она стоит
    if (card.labor && card.labor !== calc.labor) warn(`труд на карточке ${rub(card.labor)}, по действиям ${rub(calc.labor)}`);
    if (card.income !== calc.income) warn(`доход на карточке ${rub(card.income)}, по действиям ${rub(calc.income)}`);
    if (card.days !== calc.days) warn(`срок на карточке ${card.days} дн., по действиям ${calc.days} дн.`);
  }
  return issues;
}
