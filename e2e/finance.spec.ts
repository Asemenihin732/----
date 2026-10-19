/**
 * Финансы игры против живого X-Lance: все команды × раунды × варианты колоды.
 *
 * Каждый вариант — отдельный тест:
 *   1. развёртывание через интерфейс (сброс проекта) и сверка исходного состояния с планом;
 *   2. предыдущие раунды разыгрываются (последний вариант карточки);
 *   3. снимок X-Lance → решение через интерфейс → снимок X-Lance;
 *   4. сверка: деньги (xlMoneyOf), каждый платёж (название, сумма, направление,
 *      статья, плановая дата), действия с задачами и исполнителями, статус в интерфейсе.
 *
 * Итоговая таблица: e2e/results/finance-report.md (+ .json).
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { AUTH_FILE, BASE_URL } from '../playwright.config';
import { deckCards, designatedCard } from '../src/data/deck';
import { getPlan } from '../src/data/plan';
import { getProject, type TeamId } from '../src/data/projects';
import { BASE_PAYMENT_PREFIX, cardPaymentDate } from '../src/api/paymentRules';
import { ACCEPTED_GAPS, cardMoneyOf, xlMoneyOf } from '../src/game/xlMoney';
import type { Card, Variant } from '../src/game/types';
import { decide, nextRound, provisionTeam, startGame } from './game';
import { findTask, isAssigned, snapshot, workOn, type XlSnapshot } from './xlance';

const HOURS = 8;
const list = (name: string) => process.env[name]?.split(',').map((x) => x.trim()).filter(Boolean);
const onlyTeams = list('E2E_TEAMS');
const onlyRounds = list('E2E_ROUNDS')?.map(Number);
const onlyVariants = list('E2E_VARIANTS');

const cases = deckCards
  .filter((c) => !onlyTeams || onlyTeams.includes(c.team))
  .filter((c) => !onlyRounds || onlyRounds.includes(c.round ?? 0))
  .flatMap((card) =>
    card.variants.filter((v) => !onlyVariants || onlyVariants.includes(v.key)).map((variant) => ({ card, variant })),
  );

interface Row {
  team: string;
  round: number;
  card: string;
  variant: string;
  cardMoney: string;
  expected: string;
  actual: string;
  end: string;
  status: 'OK' | 'ПРОБЛЕМЫ';
  note: string;
  issues: string[];
  /** Сдвиг окончания проекта в X-Lance, рабочих дней, и на карточке */
  daysXl?: number;
  daysCard?: number;
  /** Нефинансовые пункты, которые не дошли до X-Lance (из статуса отправки) */
  notSent?: string[];
}

/** Рабочих дней между датами YYYY-MM-DD (выходные не считаются). */
function workdaysBetween(from?: string | null, to?: string | null): number {
  if (!from || !to || from === to) return 0;
  const sign = to > from ? 1 : -1;
  const [a, b] = sign > 0 ? [from, to] : [to, from];
  const d = new Date(`${a}T00:00:00Z`);
  const end = new Date(`${b}T00:00:00Z`);
  let n = 0;
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return sign * n;
}
// Строки отчёта пишутся в файл сразу: после упавшего теста воркер перезапускается,
// и память модуля теряется. Файл очищается в e2e/global-setup.ts.
const ROWS_FILE = 'e2e/results/finance-rows.jsonl';
const addRow = (row: Row) => {
  mkdirSync('e2e/results', { recursive: true });
  appendFileSync(ROWS_FILE, JSON.stringify(row) + '\n');
};
const readRows = (): Row[] =>
  existsSync(ROWS_FILE)
    ? readFileSync(ROWS_FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row)
    : [];

const rub = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
/** X-Lance считает стоимость труда в числах с плавающей точкой (184 000,0000001875) — сравниваем до копейки. */
const kop = (n: number) => Math.round(n * 100);
const sameMoney = (a: number, b: number) => kop(a) === kop(b);
const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ');

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  if (!existsSync(AUTH_FILE)) {
    throw new Error(`Нет сессии X-Lance (${AUTH_FILE}). Сначала выполните: npm run e2e:login`);
  }
  context = await browser.newContext({ storageState: AUTH_FILE, baseURL: BASE_URL });
  page = await context.newPage();
});

test.afterAll(async () => {
  // сохраняем обновлённые токены — следующий запуск не потребует входа
  if (context) {
    await context.storageState({ path: AUTH_FILE });
    await context.close();
  }
  writeReport();
});

/** Исходное состояние после развёртывания должно совпадать с планом работ. */
function checkBaseline(team: TeamId, s: XlSnapshot, issues: string[]) {
  const plan = getPlan(team);
  const labor = plan.resources.filter((r) => r.kind === 'HUMAN').reduce((sum, r) => sum + r.cost, 0);
  const other = plan.tasks.flatMap((t) => t.expenses).reduce((sum, e) => sum + e.amount, 0);
  const income = getProject(team).baseIncome;
  if (!sameMoney(s.labor, labor)) issues.push(`сброс: труд ${s.labor}, по плану ${labor}`);
  if (!sameMoney(s.otherExpenses, other)) issues.push(`сброс: прочие расходы ${s.otherExpenses}, по плану ${other}`);
  if (!sameMoney(s.income, income)) issues.push(`сброс: доход ${s.income}, по плану ${income}`);
  if (s.tasks.length !== plan.tasks.length) issues.push(`сброс: задач ${s.tasks.length}, по плану ${plan.tasks.length}`);
  const expenses = plan.tasks.flatMap((t) => t.expenses).length;
  if (s.payments.length !== expenses + 1) issues.push(`сброс: платежей ${s.payments.length}, по плану ${expenses + 1}`);
}

/** Сверка решения: платежи, действия с задачами и деньги. */
function checkDecision(team: TeamId, variant: Variant, before: XlSnapshot, after: XlSnapshot, issues: string[]) {
  const beforeIds = new Set(before.payments.map((p) => p.id));
  const created = after.payments.filter((p) => !beforeIds.has(p.id));
  const itemName = (id: string | null) => (id ? after.expenseItems[id] ?? id : null);

  /* --- платежи --- */
  const toCreate = (variant.payments ?? []).filter((p) => !p.reduce);
  if (created.length !== toCreate.length) issues.push(`создано платежей ${created.length}, ожидалось ${toCreate.length}`);
  for (const p of toCreate) {
    const direction = p.amount < 0 ? 'EXPENSE' : 'INCOME';
    const found = created.find((c) => norm(c.name) === norm(p.name) && c.direction === direction);
    if (!found) {
      issues.push(`нет ${direction === 'EXPENSE' ? 'исходящего' : 'входящего'} платежа «${p.name}»`);
      continue;
    }
    if (found.amount !== Math.abs(p.amount)) issues.push(`«${p.name}»: сумма ${found.amount}, ожидалось ${Math.abs(p.amount)}`);
    if (direction === 'EXPENSE' && p.expenseItem && norm(itemName(found.expenseItemId) ?? '') !== norm(p.expenseItem)) {
      issues.push(`«${p.name}»: статья «${itemName(found.expenseItemId)}», ожидалась «${p.expenseItem}»`);
    }
    // правило дат применяется к данным карточки: статья — из карточки, а не та,
    // которую X-Lance подставил по умолчанию («Прочие расходы») платежу без статьи
    const declaredItemId = p.expenseItem
      ? Object.entries(after.expenseItems).find(([, name]) => norm(name) === norm(p.expenseItem!))?.[0]
      : undefined;
    const date = cardPaymentDate({
      direction,
      variant,
      expenseItemId: declaredItemId,
      tasks: after.tasks as never,
      payments: before.payments as never,
    });
    if (found.planDate?.slice(0, 10) !== date) issues.push(`«${p.name}»: дата ${found.planDate?.slice(0, 10)}, ожидалась ${date}`);
  }
  for (const p of (variant.payments ?? []).filter((x) => x.reduce)) {
    const base = before.payments.find(
      (b) =>
        b.direction === 'EXPENSE' &&
        (b.description ?? '').startsWith(BASE_PAYMENT_PREFIX) &&
        norm(itemName(b.expenseItemId) ?? b.name) === norm(p.expenseItem ?? ''),
    );
    const now = base && after.payments.find((a) => a.id === base.id);
    if (!base || !now) issues.push(`сокращение: нет базового платежа по статье «${p.expenseItem}»`);
    else if (!sameMoney(now.amount, base.amount - p.amount)) {
      issues.push(`сокращение «${p.expenseItem}»: ${base.amount} → ${now.amount}, ожидалось ${base.amount - p.amount}`);
    }
  }

  /* --- задачи и исполнители --- */
  for (const a of variant.actions ?? []) {
    if (a.type === 'duration') {
      const b = findTask(before, a.task);
      const n = findTask(after, a.task);
      if (!b || !n) issues.push(`нет задачи «${a.task}»`);
      else if (n.duration !== b.duration + a.days) issues.push(`«${a.task}»: длительность ${b.duration} → ${n.duration}, ожидалось +${a.days}`);
    }
    if (a.type === 'extendProject' && !(after.end && before.end && after.end > before.end)) {
      issues.push(`срок проекта не продлён: ${before.end} → ${after.end}`);
    }
    if (a.type === 'addTask') {
      if (!findTask(after, a.name)) issues.push(`не создана задача «${a.name}»`);
      if (a.placement === 'before' && !(after.end && before.end && after.end > before.end)) {
        issues.push(`«${a.name}» перед «${a.anchor}»: срок не вырос (${before.end} → ${after.end})`);
      }
      if (a.placement === 'parallel' && after.end !== before.end) {
        issues.push(`«${a.name}» параллельно: срок изменился (${before.end} → ${after.end})`);
      }
      for (const x of a.assign ?? []) if (!isAssigned(after, a.name, x.resource)) issues.push(`«${a.name}»: не назначен «${x.resource}»`);
    }
    if (a.type === 'labor') {
      const was = workOn(before, a.task, a.resource) ?? 0;
      const now = workOn(after, a.task, a.resource) ?? 0;
      const want = Math.max(0, was + a.days * HOURS);
      if (now !== want) issues.push(`«${a.resource}» на «${a.task}»: ${was} → ${now} ч, ожидалось ${want} ч`);
    }
    if (a.type === 'reassign') {
      if (isAssigned(after, a.task, a.from)) issues.push(`«${a.from}» остался на «${a.task}»`);
      const want = (workOn(before, a.task, a.to) ?? 0) + (workOn(before, a.task, a.from) ?? 0);
      const now = workOn(after, a.task, a.to) ?? 0;
      if (now !== want) issues.push(`«${a.to}» на «${a.task}»: ${now} ч, ожидалось ${want} ч`);
    }
  }

  /* --- деньги --- */
  const expected = xlMoneyOf(team, variant);
  const cost = after.cost - before.cost;
  const income = after.income - before.income;
  if (!sameMoney(cost, expected.cost)) {
    issues.push(`расход в X-Lance ${rub(cost)} (труд ${rub(after.labor - before.labor)}, платежи ${rub(after.otherExpenses - before.otherExpenses)}), ожидалось ${rub(expected.cost)}`);
  }
  if (!sameMoney(income, expected.income)) issues.push(`доход в X-Lance ${rub(income)}, ожидалось ${rub(expected.income)}`);
  return { cost, income, expected };
}

for (const { card, variant } of cases) {
  const team = card.team as TeamId;
  const round = card.round ?? 1;
  test(`${team} · раунд ${round} · ${variant.key}. ${variant.label}`, async () => {
    const issues: string[] = [];

    await test.step('сброс развёртыванием и сверка с планом', async () => {
      await provisionTeam(page, team);
      checkBaseline(team, await snapshot(page, team), issues);
      await startGame(page, team);
    });

    await test.step('предыдущие раунды', async () => {
      for (let r = 1; r < round; r++) {
        const prev = designatedCard(team, r) as Card;
        const path = prev.variants[prev.variants.length - 1];
        const ui = await decide(page, path.key);
        if (ui.syncState !== 'ok') issues.push(`раунд ${r}: решение «${path.label}» заведено не полностью — ${ui.syncText}`);
        await nextRound(page, team);
      }
    });

    const before = await snapshot(page, team);
    const debug = process.env.E2E_DEBUG === '1';
    const ui = await test.step('решение', () => decide(page, variant.key));
    const after = await snapshot(page, team);
    if (debug) {
      console.log('DEBUG деньги', { before: [before.labor, before.otherExpenses, before.income], after: [after.labor, after.otherExpenses, after.income] });
      console.log('DEBUG задачи до', before.tasks.map((t) => `${t.name} ${t.duration}д ${t.startDate} → ${t.endDate} [${t.assignments.map((a) => `${a.planWork}ч×${a.units}`).join(',')}]`));
      console.log('DEBUG задачи после', after.tasks.map((t) => `${t.name} ${t.duration}д ${t.startDate} → ${t.endDate} [${t.assignments.map((a) => `${a.planWork}ч×${a.units}`).join(',')}]`));
      console.log('DEBUG новые платежи', after.payments.filter((p) => !before.payments.some((b) => b.id === p.id)));
    }

    if (ui.cardTitle !== card.title) issues.push(`открылась карточка «${ui.cardTitle}», ожидалась «${card.title}»`);
    if (ui.syncState !== 'ok') issues.push(`интерфейс: ${ui.syncText.replace(/\s+/g, ' ')}`);
    const { cost, income, expected } = checkDecision(team, variant, before, after, issues);

    // срок: окончание проекта в X-Lance сдвинулось на столько рабочих дней, сколько на карточке
    const daysXl = workdaysBetween(before.end?.slice(0, 10), after.end?.slice(0, 10));
    const daysCard = variant.deltaDays ?? 0;
    if (daysXl !== daysCard) issues.push(`срок: в X-Lance ${daysXl > 0 ? '+' : ''}${daysXl} раб. дн., на карточке ${daysCard > 0 ? '+' : ''}${daysCard}`);

    // нефинансовые пункты отправки, которые не прошли (интерфейс помечает их «✕»)
    const notSent = ui.syncText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('✕'))
      .map((l) => l.replace(/^✕\s*/, ''));

    const onCard = cardMoneyOf(variant);
    const gap = ACCEPTED_GAPS[`${team}:${round}:${variant.key}`];
    addRow({
      team,
      round,
      card: card.title,
      variant: `${variant.key}. ${variant.label}`,
      cardMoney: `${rub(onCard.cost)} / ${rub(onCard.income)}`,
      expected: `${rub(expected.cost)} / ${rub(expected.income)}`,
      actual: `${rub(cost)} / ${rub(income)}`,
      end: before.end === after.end ? `${after.end}` : `${before.end} → ${after.end}`,
      status: issues.length ? 'ПРОБЛЕМЫ' : 'OK',
      note: gap ? `принятое расхождение с карточкой: ${gap}` : '',
      issues,
      daysXl,
      daysCard,
      notSent,
    });
    test.info().annotations.push(...issues.map((description) => ({ type: 'проблема', description })));
    expect(issues, issues.join('\n')).toEqual([]);
  });
}

function writeReport() {
  const rows = readRows();
  if (rows.length === 0) return;
  mkdirSync('e2e/results', { recursive: true });
  writeFileSync('e2e/results/finance-report.json', JSON.stringify(rows, null, 2));
  const ok = rows.filter((r) => r.status === 'OK').length;
  const lines = [
    '# Финансы игры в X-Lance — e2e-сверка',
    '',
    `Проверено вариантов: ${rows.length}, без проблем: ${ok}, с проблемами: ${rows.length - ok}.`,
    '',
    'Деньги — «расход / доход», ₽. «Ожидалось» — модель xlMoneyOf (платежи + труд по ставкам плана), «X-Lance» — projectCost + projectFinance.',
    '',
    'Срок — сдвиг окончания проекта, рабочих дней: «карточка / X-Lance».',
    '',
    '| Команда | Р. | Карточка | Вариант | Карточка | Ожидалось | X-Lance | Срок | Окончание проекта | Итог |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.team} | ${r.round} | ${r.card} | ${r.variant} | ${r.cardMoney} | ${r.expected} | ${r.actual} | ${r.daysCard ?? 0} / ${r.daysXl ?? 0} | ${r.end} | ${r.status}${r.note ? ` ¹` : ''} |`,
    ),
    '',
    ...rows.filter((r) => r.note).map((r) => `¹ ${r.team} р${r.round} ${r.variant}: ${r.note}`),
    '',
    '## Проблемы',
    '',
    ...(rows.some((r) => r.issues.length)
      ? rows.filter((r) => r.issues.length).flatMap((r) => [`### ${r.team} · раунд ${r.round} · ${r.variant}`, ...r.issues.map((i) => `- ${i}`), ''])
      : ['Нет.']),
    '',
    '## Не дошло до X-Lance (не деньги)',
    '',
    ...(rows.some((r) => r.notSent?.length)
      ? [...new Set(rows.flatMap((r) => (r.notSent ?? []).map((x) => x.replace(/\d+ %/, 'N %'))))].map(
          (x) => `- ${x} — вариантов: ${rows.filter((r) => r.notSent?.some((y) => y.replace(/\d+ %/, 'N %') === x)).length}`,
        )
      : ['Всё дошло.']),
  ];
  writeFileSync('e2e/results/finance-report.md', lines.join('\n'));
}
