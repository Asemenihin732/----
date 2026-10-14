/**
 * Проверка движка и флоу сессии: формула индекса из методички + переходы
 * по командам и раундам, коридор удовлетворённости и сдвиг базового плана.
 */
import { formatMoney, formatPct, teamTotals, rankTeams, nominations } from '../src/game/engine';
import { createSession, initTeam, sessionReducer } from '../src/game/store';
import type { RoundDecision, TeamProgress } from '../src/game/types';

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

console.log(failures === 0 ? 'ALL TESTS PASSED' : `FAILED: ${failures}`);
