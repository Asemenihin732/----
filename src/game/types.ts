/**
 * Доменная модель игры «Спаси конференцию!».
 * Перенесена из нового интерфейса (example_for_UI) и адаптирована под
 * наш роутер и сессию (SessionState хранится в localStorage).
 */
import type { TeamId } from '../data/projects';

export type { TeamId };

export type RoundNumber = 1 | 2 | 3;

export type CardCategory =
  | 'LUDI'
  | 'PODRYADCHIKI'
  | 'ZAKAZCHIK'
  | 'FORS_MAJOR'
  | 'RESURSY'
  | 'UNIVERSAL'
  | 'BONUS';

export type VariantKey = 'A' | 'B' | 'C';

/** Платёж, который решение по карточке вносит в X-Lance. */
export interface CardPayment {
  /** Название платежа — на что он */
  name: string;
  /** Сумма, ₽: отрицательная — исходящий платёж, положительная — входящий */
  amount: number;
  /** Статья расходов X-Lance (совпадает со статьёй бюджета проекта) */
  expenseItem?: string;
  /**
   * Не новый платёж, а сокращение расхода подрядчика/материала: сумма исходящего
   * платежа по статье `expenseItem` уменьшается на `amount` (amount > 0 —
   * сэкономленные деньги). Экономия на штатном сотруднике — действие `labor`.
   */
  reduce?: boolean;
}

/**
 * Действие в X-Lance (кроме платежей и удовлетворённости), которое выполняет
 * решение по карточке. Ресурсы и задачи — по именам из плана работ.
 */
export type XlAction =
  /** Изменить длительность задачи на `days` дней */
  | { type: 'duration'; task: string; days: number }
  /** Продлить проект (последнюю задачу) — запрос на изменение срока */
  | { type: 'extendProject'; days: number }
  /**
   * Добавить в план новую задачу. `before` — встать перед задачей-якорем
   * (срок проекта растёт на длительность), `parallel` — идти параллельно
   * якорю с теми же предшественниками (срок не меняется).
   */
  | {
      type: 'addTask';
      name: string;
      /** Длительность, дн. — целое число (X-Lance не принимает дробную) */
      days: number;
      anchor: string;
      placement: 'before' | 'parallel';
      /** Исполнители и трудозатраты, чел.-дн. (0 — назначен, оплата отдельным платежом) */
      assign?: { resource: string; days: number }[];
    }
  /** Изменить трудозатраты ресурса на задаче на `days` чел.-дн. (≤ 0 итог — снять с задачи; нет на задаче — назначить) */
  | { type: 'labor'; task: string; resource: string; days: number }
  /** Передать работу ресурса `from` на задаче ресурсу `to` (новый ресурс создаётся без ставки) */
  | { type: 'reassign'; task: string; from: string; to: string }
  /** Шаг, который выполняется вручную (нет в API) — показывается команде */
  | { type: 'manual'; text: string };

/** Вариант решения по карточке */
export interface Variant {
  key: VariantKey;
  label: string;
  deltaDays?: number;
  deltaCost?: number;
  /** Сколько из `deltaCost` — труд (X-Lance пересчитывает сам), ₽ */
  laborCost?: number;
  deltaRevenue?: number;
  deltaSatisfaction?: number;
  /** Вариант требует оформления запроса на изменение */
  isChangeRequest?: boolean;
  /** Задача работ, у которой меняется длительность (имя задачи из плана X-Lance) */
  targetTask?: string;
  /** Краткое описание действия в X-Lance */
  xlanceAction: string;
  /** Пошаговый чек-лист действий в X-Lance (из колоды 18 карт) */
  xlanceSteps?: string[];
  /** Платежи для X-Lance (из колоды 18 карт) */
  payments?: CardPayment[];
  /** Действия с задачами и ресурсами X-Lance (из колоды 18 карт) */
  actions?: XlAction[];
}

/** Карточка проблемы */
export interface Card {
  id: string;
  team: TeamId | 'universal';
  round: RoundNumber | null;
  category: CardCategory;
  title: string;
  flavor: string;
  /** Бонусная карточка: приятное событие с одним вариантом «Принять» */
  bonus?: boolean;
  variants: Variant[];
}

/* -------------------------------- проекты --------------------------------- */

export interface TaskItem {
  day: string;
  task: string;
  note?: string;
}

export interface BudgetItem {
  label: string;
  calc?: string;
  cost: number;
}

/* ------------------------------- прогресс --------------------------------- */

/** Запись в журнале решений команды */
export interface RoundDecision {
  round: RoundNumber;
  cardTitle: string;
  category: CardCategory;
  variantKey: VariantKey;
  variantLabel: string;
  deltaDays: number;
  deltaCost: number;
  deltaRevenue: number;
  deltaSatisfaction: number;
  isChangeRequest: boolean;
  hadChangeRequestOption: boolean;
  /** Задача, у которой менялась длительность (если применимо) */
  targetTask?: string;
  /** Сколько ушло на решение, с (с открытия карты, без пауз) — если играли с таймером */
  spentSeconds?: number;
  /** Сколько было отведено, с (с учётом «+1 мин») — если играли с таймером */
  limitSeconds?: number;
}

/** Текущее состояние команды: базовый и фактический план */
export interface TeamProgress {
  id: TeamId;
  name: string;
  baseDurationDays: number;
  factDurationDays: number;
  baseIncome: number;
  baseCost: number;
  factIncome: number;
  factCost: number;
  satisfaction: number;
  decisions: RoundDecision[];
  changeRequestsApproved: number;
}

export interface KpiResult {
  scheduleKpi: number;
  marginKpi: number;
  satisfactionKpi: number;
  index: number;
  factMarginPct: number;
  baseMarginPct: number;
}

export type GamePhase = 'intro' | 'team-turn' | 'round-dashboard' | 'final-results';

/* -------------------------------- сессия ---------------------------------- */

export interface SessionState {
  version: number;
  /** сколько раундов играем (1–3) */
  roundCount: number;
  /** текущий раунд (1..roundCount) */
  round: number;
  /** команды в сессии */
  teamOrder: TeamId[];
  /** индекс команды, чей экран открыт */
  currentTeamIndex: number;
  teams: Record<TeamId, TeamProgress>;
  /** все раунды завершены */
  finished: boolean;
  createdAt: number;
  /** время на решение, с; null — без таймера */
  turnSeconds: number | null;
  /** идущий отсчёт хода команды (с открытия карты до решения) */
  turnTimer: TurnTimer | null;
}

/**
 * Таймер хода команды. Мягкий режим: по истечении времени выбор не блокируется,
 * идёт счётчик переработки — решение за фасилитатором.
 */
export interface TurnTimer {
  teamId: TeamId;
  round: number;
  /** когда время истекает, мс (на паузе не используется) */
  deadline: number;
  /** на паузе — сколько оставалось, мс (может быть < 0 — переработка) */
  pausedLeft: number | null;
  /** сколько отведено всего, мс (растёт от «+1 мин») */
  limitMs: number;
}

/** Остаток времени хода, мс; < 0 — переработка */
export function timerLeftMs(timer: TurnTimer, now: number): number {
  return timer.pausedLeft ?? timer.deadline - now;
}

export const SAT_MIN = 40;
export const SAT_MAX = 130;
export const SAT_START = 100;
