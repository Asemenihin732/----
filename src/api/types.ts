/**
 * DTO модулей X-Lance, используемых в игре.
 * Форматы соответствуют разделам 6–11 методички.
 */

/* --------------------------------- проекты --------------------------------- */

export interface XlProject {
  id: string;
  teamId: string;
  number: number;
  name: string;
  shortName: string;
  status: 'planning' | 'in-progress' | 'closing' | 'closed';
  baseIncome: number;
  baseCost: number;
  baseMarginPct: number;
  baseDurationDays: number;
}

export interface XlWork {
  id: string;
  period: string;
  task: string;
  note: string;
  isMilestone: boolean;
}

export interface XlBaselinePlan {
  projectId: string;
  durationDays: number;
  works: XlWork[];
}

/* ----------------------------------- Ганта ---------------------------------- */

export interface XlGanttTask {
  id: string;
  name: string;
  startDay: number;
  endDay: number;
  critical: boolean;
  dependsOn: string[];
}

/** Результат изменения длительности задачи работ (Ганта / таск-трекинг). */
export interface DurationChangeResult {
  /** Удалось ли применить изменение в X-Lance */
  changed: boolean;
  taskId?: string;
  taskName?: string;
  /** Новая длительность задачи, дн. */
  duration?: number;
  /** Пояснение: почему не применено или куда применено (край проекта) */
  reason?: string;
}

/* ---------------------------------- ресурсы --------------------------------- */

export interface XlResource {
  id: string;
  name: string;
  role: string;
  rate: number;
  days: number;
  assignment: string;
  available: boolean;
}

export interface XlCompetence {
  resourceId: string;
  skill: string;
  level: 1 | 2 | 3;
}

/* -------------------------- запросы на изменение ---------------------------- */

export type XlCrStatus = 'pending' | 'approved' | 'rejected';

export interface XlChangeRequest {
  id: string;
  projectId: string;
  cardId: string;
  cardTitle: string;
  optionTitle: string;
  deltaDays: number;
  deltaCost: number;
  deltaIncome: number;
  status: XlCrStatus;
  createdAt: string;
  decidedAt?: string;
  approver?: string;
  comment?: string;
}

/* ---------------------------------- финансы --------------------------------- */

export interface XlBudgetLine {
  id: string;
  item: string;
  calc: string;
  cost: number;
  kind: 'income' | 'expense';
}

export interface XlFinance {
  projectId: string;
  income: number;
  cost: number;
  margin: number;
  marginPct: number;
  budget: XlBudgetLine[];
}

export interface XlPaymentItem {
  id: string;
  date: string;
  title: string;
  amount: number;
  kind: 'income' | 'expense';
}

/* ------------------------------- показатели --------------------------------- */

export interface XlIndicator {
  key: string;
  name: string;
  value: number;
  unit: '%' | '₽' | 'дн.';
  min?: number;
  max?: number;
}

/* ---------------------------------- отчёты ---------------------------------- */

export interface DeviationRow {
  projectId: string;
  team: string;
  baseDays: number;
  actualDays: number;
  daysDeviation: number;
  baseMarginPct: number;
  actualMarginPct: number;
  satisfaction: number;
  index: number;
}

/* --------------------------------- прочее ----------------------------------- */

export interface XlSyncLogEntry {
  id: string;
  at: string;
  projectId: string;
  module: string;
  action: string;
  cardId?: string;
  payload?: Record<string, unknown>;
  ok: boolean;
  error?: string;
}
