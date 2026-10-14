/**
 * Mock-бэкенд X-Lance API.
 * Используется, когда VITE_API_MODE=mock (значение по умолчанию):
 * проекты и планы берутся из данных методички, показатели и отчёты —
 * из состояния игры (localStorage ключ xl-game-v1).
 */
import { PROJECTS, getProject, type TeamId } from '../data/projects';
import { rankTeams, teamTotals } from '../game/engine';
import type { SessionState, TeamProgress } from '../game/types';
import type {
  DeviationRow,
  XlBaselinePlan,
  XlBudgetLine,
  XlChangeRequest,
  XlCompetence,
  XlFinance,
  XlGanttTask,
  XlIndicator,
  XlPaymentItem,
  XlProject,
  XlResource,
  XlSyncLogEntry,
  XlWorkspaceInfo,
} from './types';

/** Ключ состояния игры в localStorage (см. game/store.tsx) */
const GAME_KEY = 'xlance-game-v2';
const MOCK_KEY = 'xlance-api-mock-v1';

interface MockDb {
  projects: XlProject[];
  changeRequests: XlChangeRequest[];
  syncLog: XlSyncLogEntry[];
  workspace: XlWorkspaceInfo | null;
}

function loadGame(): SessionState | null {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    /* ignore */
  }
  const db: MockDb = {
    projects: PROJECTS.map((p) => ({
      id: `xl-${p.id}`,
      teamId: p.id,
      number: p.number,
      name: p.name,
      shortName: p.shortName,
      status: 'planning' as const,
      baseIncome: p.baseIncome,
      baseCost: p.baseCost,
      baseMarginPct: p.baseMarginPct,
      baseDurationDays: p.baseDurationDays,
    })),
    changeRequests: [],
    syncLog: [],
    workspace: null,
  };
  saveDb(db);
  return db;
}

function saveDb(db: MockDb): void {
  try {
    localStorage.setItem(MOCK_KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

const wait = <T>(value: T, ms = 60): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const toWorks = (projectId: TeamId): XlBaselinePlan => {
  const p = getProject(projectId);
  return {
    projectId,
    durationDays: p.baseDurationDays,
    works: p.works.map((w, i) => ({
      id: `xl-task-${projectId}-${i + 1}`,
      period: w.period,
      task: w.task,
      note: w.note ?? '',
      isMilestone: w.note === 'веха',
    })),
  };
};

const toGantt = (projectId: TeamId): XlGanttTask[] => {
  const plan = toWorks(projectId);
  return plan.works.map((w, i) => {
    const days = (w.period.match(/\d+/g) ?? ['1']).map(Number);
    const start = Math.min(...days);
    const end = Math.max(...days);
    return {
      id: w.id,
      name: w.task,
      startDay: start,
      endDay: end,
      critical: w.note === 'критический путь' || w.note === 'точка невозврата' || w.note === 'внешняя зависимость',
      dependsOn: i > 0 ? [plan.works[i - 1].id] : [],
    };
  });
};

const toResources = (projectId: TeamId): XlResource[] => {
  const p = getProject(projectId);
  return p.budget
    .filter((b) => b.calc.includes('×'))
    .map((b, i) => {
      const nums = (b.calc.match(/[\d\s]+/g) ?? []).map((s) => Number(s.replace(/\s/g, '')));
      const rate = nums[0] ?? 0;
      const days = nums[1] ?? 0;
      return {
        id: `xl-res-${projectId}-${i + 1}`,
        name: b.item,
        role: b.item,
        rate,
        days,
        assignment: 'Назначен',
        available: true,
      };
    });
};

const toBudget = (projectId: TeamId): XlBudgetLine[] => {
  const p = getProject(projectId);
  const lines: XlBudgetLine[] = [
    { id: `xl-inc-${projectId}`, item: 'Доход по договору', calc: '—', cost: p.baseIncome, kind: 'income' },
  ];
  for (const b of p.budget) {
    lines.push({ id: `xl-exp-${projectId}-${b.item}`, item: b.item, calc: b.calc, cost: b.cost, kind: 'expense' });
  }
  return lines;
};

const toFinance = (projectId: TeamId): XlFinance => {
  const p = getProject(projectId);
  const game = loadGame();
  const progress = game?.teams[projectId];
  const totals = progress ? teamTotals(projectId, progress) : null;
  const income = totals?.actualIncome ?? p.baseIncome;
  const cost = totals?.actualCost ?? p.baseCost;
  return {
    projectId,
    income,
    cost,
    margin: income - cost,
    marginPct: income === 0 ? 0 : ((income - cost) / income) * 100,
    budget: toBudget(projectId),
  };
};

const toPayments = (projectId: TeamId): XlPaymentItem[] => {
  const p = getProject(projectId);
  return [
    { id: `xl-pay-in-${projectId}`, date: 'День Х', title: 'Оплата по договору', amount: p.baseIncome, kind: 'income' },
    ...p.budget.map((b, i) => ({
      id: `xl-pay-exp-${projectId}-${i}`,
      date: 'в ходе проекта',
      title: b.item,
      amount: b.cost,
      kind: 'expense' as const,
    })),
  ];
};

const toIndicators = (projectId: TeamId): XlIndicator[] => {
  const game = loadGame();
  const satisfaction = game?.teams[projectId]?.satisfaction ?? 100;
  return [
    { key: 'customer-satisfaction', name: 'Удовлетворённость заказчика', value: satisfaction, unit: '%', min: 40, max: 130 },
    { key: 'schedule-deviation', name: 'Отклонение по сроку', value: 0, unit: 'дн.' },
  ];
};

const competences = (projectId: TeamId): XlCompetence[] =>
  toResources(projectId).map((r, i) => ({
    resourceId: r.id,
    skill: ['Управление проектом', 'Техническая экспертиза', 'Коммуникации'][i % 3],
    level: ((i % 3) + 1) as 1 | 2 | 3,
  }));

const deviations = (): DeviationRow[] => {
  const game = loadGame();
  const ordered = (game?.teamOrder ?? [])
    .map((teamId) => ({ teamId, progress: game?.teams[teamId] }))
    .filter((e): e is { teamId: TeamId; progress: TeamProgress } => Boolean(e.progress));
  if (ordered.length === 0) {
    return PROJECTS.map((p) => ({
      projectId: p.id,
      team: p.shortName,
      baseDays: p.baseDurationDays,
      actualDays: p.baseDurationDays,
      daysDeviation: 0,
      baseMarginPct: p.baseMarginPct,
      actualMarginPct: p.baseMarginPct,
      satisfaction: 100,
      index: 100,
    }));
  }
  return rankTeams(ordered).map(({ teamId, totals }) => ({
    projectId: teamId,
    team: getProject(teamId).shortName,
    baseDays: totals.baseDays,
    actualDays: totals.actualDays,
    daysDeviation: totals.actualDays - totals.baseDays,
    baseMarginPct: totals.baseMarginPct,
    actualMarginPct: totals.actualMarginPct,
    satisfaction: totals.satisfaction,
    index: totals.index,
  }));
};

export const mockBackend = {
  /* ------------------------------- проекты ---------------------------------- */
  async listProjects(): Promise<XlProject[]> {
    return wait(loadDb().projects);
  },

  async getProject(id: string): Promise<XlProject> {
    const found = loadDb().projects.find((p) => p.id === id || p.teamId === id);
    if (!found) throw new Error(`Проект не найден: ${id}`);
    return wait(found);
  },

  async createTeamProject(teamId: TeamId, name?: string): Promise<XlProject> {
    const db = loadDb();
    const p = getProject(teamId);
    const existing = db.projects.find((x) => x.teamId === teamId);
    if (existing) return wait(existing);
    const project: XlProject = {
      id: `xl-${teamId}`,
      teamId,
      number: p.number,
      name: name ?? p.name,
      shortName: p.shortName,
      status: 'planning',
      baseIncome: p.baseIncome,
      baseCost: p.baseCost,
      baseMarginPct: p.baseMarginPct,
      baseDurationDays: p.baseDurationDays,
    };
    db.projects.push(project);
    saveDb(db);
    return wait(project);
  },

  /* -------------------------------- планы ----------------------------------- */
  async baselinePlan(projectId: TeamId): Promise<XlBaselinePlan> {
    return wait(toWorks(projectId));
  },

  /* --------------------------------- Ганта ---------------------------------- */
  async ganttTasks(projectId: TeamId): Promise<XlGanttTask[]> {
    return wait(toGantt(projectId));
  },

  async shiftTask(projectId: TeamId, taskId: string, days: number): Promise<XlGanttTask> {
    const tasks = toGantt(projectId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Задача не найдена: ${taskId}`);
    const shifted = { ...task, startDay: task.startDay + days, endDay: task.endDay + days };
    return wait(shifted);
  },

  /* -------------------------------- ресурсы --------------------------------- */
  async listResources(projectId: TeamId): Promise<XlResource[]> {
    return wait(toResources(projectId));
  },

  async replaceResource(projectId: TeamId, resourceId: string, newName: string): Promise<XlResource> {
    const res = toResources(projectId).find((r) => r.id === resourceId);
    if (!res) throw new Error(`Ресурс не найден: ${resourceId}`);
    return wait({ ...res, name: newName, assignment: 'Замена' });
  },

  async setResourceRate(projectId: TeamId, resourceId: string, rate: number): Promise<XlResource> {
    const res = toResources(projectId).find((r) => r.id === resourceId);
    if (!res) throw new Error(`Ресурс не найден: ${resourceId}`);
    return wait({ ...res, rate, assignment: 'Ставка изменена' });
  },

  async competenceMatrix(projectId: TeamId): Promise<XlCompetence[]> {
    return wait(competences(projectId));
  },

  /* -------------------------- запросы на изменение -------------------------- */
  async listChangeRequests(projectId?: TeamId): Promise<XlChangeRequest[]> {
    const db = loadDb();
    return wait(projectId ? db.changeRequests.filter((c) => c.projectId === projectId) : db.changeRequests);
  },

  async createChangeRequest(payload: Omit<XlChangeRequest, 'id' | 'status' | 'createdAt'>): Promise<XlChangeRequest> {
    const db = loadDb();
    const cr: XlChangeRequest = {
      ...payload,
      id: `xl-cr-${Date.now().toString(36)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.changeRequests.push(cr);
    saveDb(db);
    return wait(cr);
  },

  async approveChangeRequest(id: string, comment?: string): Promise<XlChangeRequest> {
    const db = loadDb();
    const cr = db.changeRequests.find((c) => c.id === id);
    if (!cr) throw new Error(`Запрос не найден: ${id}`);
    cr.status = 'approved';
    cr.decidedAt = new Date().toISOString();
    cr.approver = 'Заказчик (фасилитатор)';
    cr.comment = comment;
    saveDb(db);
    return wait(cr);
  },

  async rejectChangeRequest(id: string, comment?: string): Promise<XlChangeRequest> {
    const db = loadDb();
    const cr = db.changeRequests.find((c) => c.id === id);
    if (!cr) throw new Error(`Запрос не найден: ${id}`);
    cr.status = 'rejected';
    cr.decidedAt = new Date().toISOString();
    cr.approver = 'Заказчик (фасилитатор)';
    cr.comment = comment;
    saveDb(db);
    return wait(cr);
  },

  /* -------------------------------- финансы --------------------------------- */
  async finance(projectId: TeamId): Promise<XlFinance> {
    return wait(toFinance(projectId));
  },

  async addExpense(projectId: TeamId, item: string, amount: number): Promise<XlFinance> {
    // В демо-режиме расходы уже учтены в решении команды — только логируем
    mockBackend.logSync(projectId, 'finance', `Внеплановый расход: ${item}`, true, { item, amount });
    return wait(toFinance(projectId));
  },

  async addIncome(projectId: TeamId, item: string, amount: number): Promise<XlFinance> {
    mockBackend.logSync(projectId, 'finance', `Дополнительный доход: ${item}`, true, { item, amount });
    return wait(toFinance(projectId));
  },

  async paymentCalendar(projectId: TeamId): Promise<XlPaymentItem[]> {
    return wait(toPayments(projectId));
  },

  /* ------------------------------- показатели ------------------------------- */
  async listIndicators(projectId: TeamId): Promise<XlIndicator[]> {
    return wait(toIndicators(projectId));
  },

  async setIndicator(projectId: TeamId, key: string, value: number): Promise<XlIndicator> {
    const indicators = toIndicators(projectId);
    const ind = indicators.find((i) => i.key === key) ?? indicators[0];
    return wait({ ...ind, value });
  },

  /* --------------------------------- отчёты --------------------------------- */
  async deviations(): Promise<DeviationRow[]> {
    return wait(deviations());
  },

  async statusReport(projectId: TeamId): Promise<Record<string, unknown>> {
    const finance = toFinance(projectId);
    const indicators = toIndicators(projectId);
    return wait({
      projectId,
      finance,
      indicators,
      works: toWorks(projectId).works.length,
      tasks: toGantt(projectId).length,
    });
  },

  async biReport(): Promise<{ index: number; teams: DeviationRow[] }> {
    const rows = deviations();
    return wait({ index: Math.round(rows.reduce((s, r) => s + r.index, 0) / Math.max(rows.length, 1)), teams: rows });
  },

  /* ------------------------------ подготовка -------------------------------- */
  async prepareDemoSpace(teamIds: TeamId[]): Promise<XlWorkspaceInfo> {
    const db = loadDb();
    for (const id of teamIds) {
      if (!db.projects.some((p) => p.teamId === id)) {
        const p = getProject(id);
        db.projects.push({
          id: `xl-${id}`,
          teamId: id,
          number: p.number,
          name: p.name,
          shortName: p.shortName,
          status: 'planning',
          baseIncome: p.baseIncome,
          baseCost: p.baseCost,
          baseMarginPct: p.baseMarginPct,
          baseDurationDays: p.baseDurationDays,
        });
      }
    }
    db.workspace = {
      id: 'demo-pmfest-2026',
      name: 'PMFest 2026 · демо-пространство',
      projectCount: db.projects.length,
      preparedAt: new Date().toISOString(),
      checklist: [
        'Создано демо-пространство и шесть проектов',
        'Загружены базовые планы и бюджеты',
        'Настроены ресурсные планы',
        'Заведён показатель «Удовлетворённость заказчика» (старт 100%)',
        'Роль «Руководитель проекта» выдана командам',
        'Включено согласование изменений (согласующий — Заказчик)',
        'Отчёт по отклонениям строится по всем проектам',
      ],
    };
    saveDb(db);
    return wait(db.workspace);
  },

  /* -------------------------------- синхронизация --------------------------- */
  logSync(projectId: string, module: string, action: string, ok: boolean, payload?: Record<string, unknown>, error?: string): XlSyncLogEntry {
    const db = loadDb();
    const entry: XlSyncLogEntry = {
      id: `xl-log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      projectId,
      module,
      action,
      ok,
      error,
      payload,
    };
    db.syncLog = [entry, ...db.syncLog].slice(0, 100);
    saveDb(db);
    return entry;
  },

  async syncLog(): Promise<XlSyncLogEntry[]> {
    return wait(loadDb().syncLog);
  },

  async resetMock(): Promise<void> {
    try {
      localStorage.removeItem(MOCK_KEY);
    } catch {
      /* ignore */
    }
    loadDb();
    return wait(undefined);
  },
};
