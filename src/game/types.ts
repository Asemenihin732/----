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

/** Вариант решения по карточке */
export interface Variant {
  key: VariantKey;
  label: string;
  deltaDays?: number;
  deltaCost?: number;
  deltaRevenue?: number;
  deltaSatisfaction?: number;
  /** Вариант требует оформления запроса на изменение */
  isChangeRequest?: boolean;
  /** Краткое описание действия в X-Lance */
  xlanceAction: string;
  /** Пошаговый чек-лист действий в X-Lance (из колоды 18 карт) */
  xlanceSteps?: string[];
}

/** Карточка проблемы */
export interface Card {
  id: string;
  team: TeamId | 'universal';
  round: RoundNumber | null;
  category: CardCategory;
  title: string;
  flavor: string;
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
}

export const SAT_MIN = 40;
export const SAT_MAX = 130;
export const SAT_START = 100;
