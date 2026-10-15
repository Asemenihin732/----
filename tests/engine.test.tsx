/**
 * Проверка движка и флоу сессии: формула индекса из методички + переходы
 * по командам и раундам, коридор удовлетворённости и сдвиг базового плана.
 */
import { formatMoney, formatPct, teamTotals, rankTeams, nominations } from '../src/game/engine';
import { createSession, initTeam, sessionReducer } from '../src/game/store';
import type { RoundDecision, TeamProgress } from '../src/game/types';
import { deckCards, designatedCard } from '../src/data/deck';
import { PROJECTS } from '../src/data/projects';
import { getPlan } from '../src/data/plan';
import { ACCEPTED_GAPS, cardMoneyOf, xlMoneyOf } from '../src/game/xlMoney';
import { cardPaymentDate, cardPayments, paymentDirection } from '../src/api/paymentSync';

let failures = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${name}: ${JSON.stringify(actual)}${ok ? '' : ' ожидалось ' + JSON.stringify(expected)}`,
  );
};

const decision = (over: Partial<RoundDecision>): RoundDecision => ({
  round: 1,
  cardTitle: 't',
  category: 'LUDI',
  variantKey: 'B',
  variantLabel: 'o',
  deltaDays: 0,
  deltaCost: 0,
  deltaRevenue: 0,
  deltaSatisfaction: 0,
  isChangeRequest: false,
  hadChangeRequestOption: false,
  ...over,
});

/** Прогресс с явными базовыми и фактическими значениями */
const mk = (id: TeamProgress['id'], over: Partial<TeamProgress>): TeamProgress => ({
  ...initTeam(id),
  ...over,
});

/* ---------- 1. Пример расчёта из методички (раздел 2) ---------- */
const progress: TeamProgress = mk('catering', {
  satisfaction: 85,
  baseDurationDays: 6,
  factDurationDays: 6.5,
  baseIncome: 1_200_000,
  baseCost: 900_000,
  factIncome: 1_295_000,
  factCost: 1_085_000,
  decisions: [decision({ deltaDays: 0.5, deltaCost: 185_000, deltaRevenue: 95_000 })],
});
const t = teamTotals('catering', progress);
console.log(
  `— срок ${t.actualDays} дн., расход ${formatMoney(t.actualCost)}, доход ${formatMoney(t.actualIncome)}, маржа ${formatPct(t.actualMarginPct, 1)} —`,
);
check('срок', t.actualDays, 6.5);
check('расход', t.actualCost, 1_085_000);
check('доход', t.actualIncome, 1_295_000);
check('маржа %', Math.round(t.actualMarginPct * 10) / 10, 16.2);
check('KPI Срок = 92', Math.round(t.kpiDays), 92);
check('KPI Маржа = 65', Math.round(t.kpiMargin), 65);
check('KPI Удовл. = 85', t.kpiSatisfaction, 85);
check('Индекс = 81', Math.round(t.index), 81);

/* ---------- 2. Отрицательная маржа → KPI 0 ---------- */
check(
  'отрицательная маржа → KPI 0',
  teamTotals(
    'catering',
    mk('catering', { baseIncome: 1_000_000, baseCost: 800_000, factIncome: 1_000_000, factCost: 1_200_000 }),
  ).kpiMargin,
  0,
);

/* ---------- 3. Запрос на изменение двигает базовый план ---------- */
let cr = createSession(1, ['catering']);
const before = cr.teams.catering;
cr = sessionReducer(cr, {
  type: 'submit',
  teamId: 'catering',
  decision: decision({ isChangeRequest: true, deltaDays: 1, deltaCost: 90_000, deltaRevenue: 120_000 }),
});
check('базовый срок вырос на 1 день', cr.teams.catering.baseDurationDays, before.baseDurationDays + 1);
check('базовый доход вырос на 120 000', cr.teams.catering.baseIncome, before.baseIncome + 120_000);
check('базовый расход вырос на 90 000', cr.teams.catering.baseCost, before.baseCost + 90_000);
check('запросов на изменение учтено', cr.teams.catering.changeRequestsApproved, 1);

/* ---------- 4. Переходы по командам и раундам ---------- */
let s = createSession(2, ['catering', 'stage']);
check('старт: команда 1, раунд 1', [s.currentTeamIndex, s.round, s.finished], [0, 1, false]);
s = sessionReducer(s, { type: 'submit', teamId: 'catering', decision: decision({ deltaDays: 0.5 }) });
check('после решения команда та же', s.currentTeamIndex, 0);
s = sessionReducer(s, { type: 'advanceTeam' });
check('advanceTeam → команда 2', s.currentTeamIndex, 1);
s = sessionReducer(s, { type: 'submit', teamId: 'stage', decision: decision({ deltaDays: -1 }) });
s = sessionReducer(s, { type: 'advanceRound' });
check('advanceRound → раунд 2, команда 1', [s.currentTeamIndex, s.round], [0, 2]);
s = sessionReducer(s, { type: 'submit', teamId: 'catering', decision: decision({ deltaCost: 30_000 }) });
s = sessionReducer(s, { type: 'advanceTeam' });
s = sessionReducer(s, { type: 'submit', teamId: 'stage', decision: decision({ deltaCost: 20_000 }) });
s = sessionReducer(s, { type: 'advanceRound' });
check('финал двух раундов', [s.round, s.finished], [2, true]);
check('решения catering', s.teams.catering.decisions.length, 2);
check('срок catering +0,5 дня', teamTotals('catering', s.teams.catering).actualDays, 6.5);
check('срок stage −1 день', teamTotals('stage', s.teams.stage).actualDays, 5);

/* ---------- 5. Коридор удовлетворённости 40–130 ---------- */
let s2 = createSession(1, ['catering']);
for (let i = 0; i < 2; i++) {
  s2 = sessionReducer(s2, {
    type: 'submit',
    teamId: 'catering',
    decision: decision({ deltaSatisfaction: -25, variantKey: 'C' }),
  });
}
check('коридор 40 при −50 п.п.', s2.teams.catering.satisfaction, 50);

/* ---------- 6. Ранжирование и номинации ---------- */
const strong = mk('catering', {
  satisfaction: 85,
  factDurationDays: 6.5,
  factIncome: 1_295_000,
  factCost: 1_085_000,
});
const calm = mk('stage', { satisfaction: 100 });
const ranked = rankTeams([
  { teamId: 'catering', progress: strong },
  { teamId: 'stage', progress: calm },
]);
check('первое место — лидер', ranked[0].totals.index >= ranked[1].totals.index, true);
const nom = nominations([
  { teamId: 'catering', progress: strong },
  { teamId: 'stage', progress: calm },
]);
check('любимец заказчика', nom.customerFavorite, ['stage']);

/* ---------- колода → X-Lance: платежи и действия дают те же деньги, что и карточка ---------- */
// Расход в X-Lance = исходящие платежи − сокращения платежей + труд по ставкам плана
// (трудозатраты, переназначения, исполнители новых задач). Доход = входящие платежи.
// Принятые расхождения — ACCEPTED_GAPS (src/game/xlMoney.ts): в X-Lance честная стоимость, в игре числа с карточки.
let paymentCount = 0;
const paymentProblems: string[] = [];
const moneyGaps: string[] = [];
for (const project of PROJECTS) {
  const plan = getPlan(project.id);
  const budgetItems = new Set(project.budget.map((b) => b.item));
  const planTasks = new Set(plan.tasks.map((t) => t.name));
  const planResources = new Set(plan.resources.map((r) => r.name));
  const rate = (name: string) => plan.resources.find((r) => r.name === name && r.kind === 'HUMAN')?.ratePerDay ?? 0;
  const workOf = (task: string, resource: string) =>
    plan.tasks.find((t) => t.name === task)?.assignments.find((a) => a.resource === resource)?.days ?? 0;
  for (const round of [1, 2, 3]) {
    const card = designatedCard(project.id, round);
    if (!card) continue;
    for (const v of card.variants) {
      const where = `${project.id} р${round} «${card.title}» ${v.key}`;
      const list = v.payments ?? [];
      paymentCount += list.length;
      let cost = 0;
      let income = 0;
      for (const p of list) {
        if (!p.name.trim() || p.amount === 0) paymentProblems.push(`${where}: пустой платёж`);
        if (p.expenseItem && !budgetItems.has(p.expenseItem))
          paymentProblems.push(`${where}: статьи «${p.expenseItem}» нет в бюджете проекта`);
        if (p.reduce) cost -= p.amount;
        else if (p.amount < 0) cost += -p.amount;
        else income += p.amount;
      }
      const added = new Set<string>();
      for (const a of v.actions ?? []) {
        const needTask = (name: string) => {
          if (!planTasks.has(name) && !added.has(name)) paymentProblems.push(`${where}: нет задачи «${name}» в плане`);
        };
        const needResource = (name: string) => {
          if (!planResources.has(name)) paymentProblems.push(`${where}: нет ресурса «${name}» в плане`);
        };
        if (a.type === 'duration') needTask(a.task);
        if (a.type === 'labor') {
          needTask(a.task);
          needResource(a.resource);
          cost += rate(a.resource) * a.days;
        }
        if (a.type === 'reassign') {
          needTask(a.task);
          needResource(a.from);
          cost += (rate(a.to) - rate(a.from)) * workOf(a.task, a.from);
        }
        if (a.type === 'addTask') {
          needTask(a.anchor);
          if (!Number.isInteger(a.days)) paymentProblems.push(`${where}: длительность «${a.name}» не целая`);
          added.add(a.name);
          for (const x of a.assign ?? []) cost += rate(x.resource) * x.days;
        }
      }
      // ручной подсчёт выше должен совпасть с общей моделью xlMoneyOf (её же использует e2e)
      const model = xlMoneyOf(project.id, v);
      if (model.cost !== cost || model.income !== income) paymentProblems.push(`${where}: модель xlMoneyOf расходится`);
      const onCard = cardMoneyOf(v);
      if (model.cost !== onCard.cost || model.income !== onCard.income) moneyGaps.push(`${project.id}:${round}:${v.key}`);
    }
  }
}
check('платежи и действия колоды ссылаются на план и бюджет', paymentProblems, []);
check(
  'деньги в X-Lance совпадают с карточками (кроме принятых расхождений)',
  moneyGaps,
  Object.keys(ACCEPTED_GAPS),
);
check('колода — ровно 18 карточек из файла', deckCards.length, 18);
check(
  'у каждой команды своя карточка на каждый из раундов 1–3',
  PROJECTS.every((p) => [1, 2, 3].every((r) => designatedCard(p.id, r)?.team === p.id)),
  true,
);
check(
  'бонусные карточки — с одним вариантом «Принять»',
  deckCards.filter((c) => c.bonus).map((c) => [c.title, c.variants.map((v) => v.label)]),
  [
    ['Саундчек со звёздным гостем', ['Принять']],
    ['Автобус-экскурсовод', ['Принять']],
  ],
);
check(
  'входящие платежи колоды (доход: 4 запроса на изменение и экскурсия)',
  deckCards
    .flatMap((c) => c.variants.flatMap((v) => v.payments ?? []))
    .filter((p) => p.amount > 0 && !p.reduce).length,
  5,
);

/* ---------- базовые платежи из плана работ ---------- */
const baseProblems: string[] = [];
for (const project of PROJECTS) {
  const plan = getPlan(project.id);
  const expenses = plan.tasks.flatMap((t) => t.expenses);
  const fromTasks = expenses.reduce((s, e) => s + e.amount, 0);
  const fromTable = plan.resources.filter((r) => r.kind === 'EXPENSE').reduce((s, r) => s + r.cost, 0);
  if (fromTasks !== fromTable) baseProblems.push(`${project.id}: расходы задач ${fromTasks} ≠ таблица ${fromTable}`);
  // сокращение расхода — по статье базового расхода или трудового ресурса проекта
  const items = new Set([
    ...expenses.map((e) => e.item),
    ...plan.resources.filter((r) => r.kind === 'HUMAN').map((r) => r.name),
  ]);
  for (const card of deckCards.filter((c) => c.team === project.id))
    for (const v of card.variants)
      for (const p of v.payments ?? [])
        if (p.reduce && !items.has(p.expenseItem ?? ''))
          baseProblems.push(`${project.id} «${card.title}» ${v.key}: в плане нет статьи «${p.expenseItem}»`);
}
check('базовые расходы плана сходятся с таблицей ресурсов и расходов', baseProblems, []);
check('сокращение расхода меняет исходящий платёж', paymentDirection(20_000, true), 'EXPENSE');
check('в колоде есть платежи', paymentCount > 0, true);
check('направление: минус — исходящий', paymentDirection(-25_000), 'EXPENSE');
check('направление: плюс — входящий', paymentDirection(110_000), 'INCOME');

/* ---------- ни один денежный пункт не теряется: платежи из изменений варианта ---------- */
const looseCard = { ...deckCards[0], title: 'Ферма не проходит в грузовой лифт' };
check(
  'вариант без платежей: расход → исходящий платёж',
  cardPayments(looseCard, { key: 'A', label: 'Нанять альпинистов', xlanceAction: '', deltaCost: 55_000 }),
  [{ name: 'Ферма не проходит в грузовой лифт: Нанять альпинистов', amount: -55_000 }],
);
check(
  'вариант без платежей: доход → входящий, экономия → сокращение расхода',
  cardPayments(looseCard, { key: 'C', label: 'Сцена меньше', xlanceAction: '', deltaCost: -20_000, deltaRevenue: 5_000 }).map(
    (p) => [p.amount, Boolean(p.reduce)],
  ),
  [
    [20_000, true],
    [5_000, false],
  ],
);
check(
  'у карточек колоды платежи берутся только из колоды',
  deckCards.every((c) => c.variants.every((v) => v.payments !== undefined && cardPayments(c, v) === v.payments)),
  true,
);

/* ---------- плановые даты платежей по карточке ---------- */
{
  const tasks = [
    { id: 't1', code: '', name: 'Монтаж', projectId: 'p', objectTypeId: 'x', startDate: '2026-10-20', endDate: '2026-10-21' },
    { id: 't2', code: '', name: 'Устранение наводки', projectId: 'p', objectTypeId: 'x', startDate: '2026-10-22', endDate: '2026-10-22' },
    { id: 't0', code: '', name: 'ТЗ', projectId: 'p', objectTypeId: 'x', startDate: '2026-10-15', endDate: '2026-10-15' },
  ];
  const payments = [
    { id: 'b', name: 'Аренда', amount: 1, direction: 'EXPENSE' as const, expenseItemId: 'rent', description: 'Базовый план · задача', objectTypeId: '', projectId: 'p', statusId: '', planDate: '2026-10-16', isPaid: false },
  ];
  const v = (actions: NonNullable<import('../src/game/types').Variant['actions']>) => ({ key: 'A' as const, label: '', xlanceAction: '', actions });
  check('дата: доход — окончание проекта', cardPaymentDate({ direction: 'INCOME', variant: v([]), tasks, payments }), '2026-10-22');
  check(
    'дата: расход новой задачи — её начало',
    cardPaymentDate({ direction: 'EXPENSE', variant: v([{ type: 'addTask', name: 'Устранение наводки', days: 1, anchor: 'Монтаж', placement: 'parallel' }]), expenseItemId: 'rent', tasks, payments }),
    '2026-10-22',
  );
  check(
    'дата: расход по изменённой задаче — её начало',
    cardPaymentDate({ direction: 'EXPENSE', variant: v([{ type: 'duration', task: 'Монтаж', days: 1 }]), tasks, payments }),
    '2026-10-20',
  );
  check('дата: расход по статье — дата базового платежа', cardPaymentDate({ direction: 'EXPENSE', variant: v([]), expenseItemId: 'rent', tasks, payments }), '2026-10-16');
  check('дата: иначе — начало проекта', cardPaymentDate({ direction: 'EXPENSE', variant: v([]), tasks, payments }), '2026-10-15');
}

console.log(failures === 0 ? 'ALL TESTS PASSED' : `FAILED: ${failures}`);
