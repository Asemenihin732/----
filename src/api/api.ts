/**
 * api.ts — заготовка для работы с реальными данными X-Lance.
 *
 * Каждый метод работает в одном из двух режимов (VITE_API_MODE):
 *   • mock — демо-данные (localStorage), режим по умолчанию для игры;
 *   • http — реальный X-Lance API: URL, токен и workspace из .env.
 *
 * Эндпоинты в http-ветке соответствуют разделам 6–11 методички
 * (проекты, базовые планы, Ганта, ресурсы, запросы на изменения,
 * финансы, пользовательские показатели, отчёты). При появлении
 * актуальной спецификации API — правится только http-ветка.
 */
import { apiConfig, configWarnings, isMockMode } from './config';
import { http } from './http';
import { mockBackend } from './mockBackend';
import type {
  DeviationRow,
  XlBaselinePlan,
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
import type { TeamId } from '../data/projects';

export type { DeviationRow, XlProject, XlChangeRequest, XlSyncLogEntry, XlWorkspaceInfo, XlIndicator };

/* --------------------------------- клиент ---------------------------------- */

export const api = {
  /** Текущий режим и предупреждения конфигурации */
  meta: {
    mode: apiConfig.mode,
    isMock: isMockMode(),
    baseUrl: apiConfig.baseUrl,
    warnings: configWarnings(),
  },

  /* --------------------------------- проекты -------------------------------- */
  projects: {
    list: (): Promise<XlProject[]> =>
      isMockMode() ? mockBackend.listProjects() : http.get<XlProject[]>('/projects'),

    get: (id: string): Promise<XlProject> =>
      isMockMode() ? mockBackend.getProject(id) : http.get<XlProject>(`/projects/${id}`),

    /** Создать проект команды в демо-пространстве (раздел 7) */
    create: (teamId: TeamId, name?: string): Promise<XlProject> =>
      isMockMode()
        ? mockBackend.createTeamProject(teamId, name)
        : http.post<XlProject>('/projects', { teamId, name }),
  },

  /* ------------------------------ базовый план ------------------------------- */
  plans: {
    baseline: (projectId: TeamId): Promise<XlBaselinePlan> =>
      isMockMode() ? mockBackend.baselinePlan(projectId) : http.get<XlBaselinePlan>(`/projects/${projectId}/baseline`),

    update: (projectId: TeamId, works: XlBaselinePlan['works']): Promise<XlBaselinePlan> =>
      isMockMode()
        ? mockBackend.baselinePlan(projectId).then((plan) => ({ ...plan, works }))
        : http.patch<XlBaselinePlan>(`/projects/${projectId}/baseline`, { works }),
  },

  /* ---------------------------- диаграмма Ганта ------------------------------ */
  gantt: {
    tasks: (projectId: TeamId): Promise<XlGanttTask[]> =>
      isMockMode() ? mockBackend.ganttTasks(projectId) : http.get<XlGanttTask[]>(`/projects/${projectId}/gantt`),

    shiftTask: (projectId: TeamId, taskId: string, days: number): Promise<XlGanttTask> =>
      isMockMode()
        ? mockBackend.shiftTask(projectId, taskId, days)
        : http.patch<XlGanttTask>(`/projects/${projectId}/gantt/${taskId}`, { shiftDays: days }),

    recalc: (projectId: TeamId): Promise<XlGanttTask[]> =>
      isMockMode() ? mockBackend.ganttTasks(projectId) : http.post<XlGanttTask[]>(`/projects/${projectId}/gantt/recalc`),
  },

  /* -------------------------------- ресурсы ---------------------------------- */
  resources: {
    list: (projectId: TeamId): Promise<XlResource[]> =>
      isMockMode() ? mockBackend.listResources(projectId) : http.get<XlResource[]>(`/projects/${projectId}/resources`),

    replace: (projectId: TeamId, resourceId: string, newName: string): Promise<XlResource> =>
      isMockMode()
        ? mockBackend.replaceResource(projectId, resourceId, newName)
        : http.patch<XlResource>(`/projects/${projectId}/resources/${resourceId}`, { name: newName, assignment: 'Замена' }),

    setRate: (projectId: TeamId, resourceId: string, rate: number): Promise<XlResource> =>
      isMockMode()
        ? mockBackend.setResourceRate(projectId, resourceId, rate)
        : http.patch<XlResource>(`/projects/${projectId}/resources/${resourceId}`, { rate }),

    matrix: (projectId: TeamId): Promise<XlCompetence[]> =>
      isMockMode()
        ? mockBackend.competenceMatrix(projectId)
        : http.get<XlCompetence[]>(`/projects/${projectId}/competences`),
  },

  /* -------------------------- запросы на изменение --------------------------- */
  changeRequests: {
    list: (projectId?: TeamId): Promise<XlChangeRequest[]> =>
      isMockMode()
        ? mockBackend.listChangeRequests(projectId)
        : http.get<XlChangeRequest[]>('/change-requests', { projectId }),

    create: (payload: {
      projectId: TeamId;
      cardId: string;
      cardTitle: string;
      optionTitle: string;
      deltaDays: number;
      deltaCost: number;
      deltaIncome: number;
    }): Promise<XlChangeRequest> =>
      isMockMode()
        ? mockBackend.createChangeRequest(payload)
        : http.post<XlChangeRequest>('/change-requests', payload),

    approve: (id: string, comment?: string): Promise<XlChangeRequest> =>
      isMockMode()
        ? mockBackend.approveChangeRequest(id, comment)
        : http.post<XlChangeRequest>(`/change-requests/${id}/approve`, { comment }),

    reject: (id: string, comment?: string): Promise<XlChangeRequest> =>
      isMockMode()
        ? mockBackend.rejectChangeRequest(id, comment)
        : http.post<XlChangeRequest>(`/change-requests/${id}/reject`, { comment }),
  },

  /* --------------------------------- финансы --------------------------------- */
  finance: {
    get: (projectId: TeamId): Promise<XlFinance> =>
      isMockMode() ? mockBackend.finance(projectId) : http.get<XlFinance>(`/projects/${projectId}/finance`),

    addExpense: (projectId: TeamId, item: string, amount: number): Promise<XlFinance> =>
      isMockMode()
        ? mockBackend.addExpense(projectId, item, amount)
        : http.post<XlFinance>(`/projects/${projectId}/finance/expenses`, { item, amount }),

    addIncome: (projectId: TeamId, item: string, amount: number): Promise<XlFinance> =>
      isMockMode()
        ? mockBackend.addIncome(projectId, item, amount)
        : http.post<XlFinance>(`/projects/${projectId}/finance/income`, { item, amount }),

    paymentCalendar: (projectId: TeamId): Promise<XlPaymentItem[]> =>
      isMockMode()
        ? mockBackend.paymentCalendar(projectId)
        : http.get<XlPaymentItem[]>(`/projects/${projectId}/payments`),
  },

  /* ------------------------- пользовательские показатели --------------------- */
  indicators: {
    /** «Удовлетворённость заказчика» — показатель с коридором 40–130% */
    list: (projectId: TeamId): Promise<XlIndicator[]> =>
      isMockMode()
        ? mockBackend.listIndicators(projectId)
        : http.get<XlIndicator[]>(`/projects/${projectId}/indicators`),

    setValue: (projectId: TeamId, key: string, value: number): Promise<XlIndicator> =>
      isMockMode()
        ? mockBackend.setIndicator(projectId, key, value)
        : http.patch<XlIndicator>(`/projects/${projectId}/indicators/${key}`, { value }),
  },

  /* ---------------------------------- отчёты --------------------------------- */
  reports: {
    /** Отчёт по отклонениям сразу по всем проектам */
    deviations: (): Promise<DeviationRow[]> =>
      isMockMode() ? mockBackend.deviations() : http.get<DeviationRow[]>('/reports/deviations'),

    status: (projectId: TeamId): Promise<Record<string, unknown>> =>
      isMockMode() ? mockBackend.statusReport(projectId) : http.get<Record<string, unknown>>(`/projects/${projectId}/status`),

    bi: (): Promise<{ index: number; teams: DeviationRow[] }> =>
      isMockMode() ? mockBackend.biReport() : http.get<{ index: number; teams: DeviationRow[] }>('/reports/bi'),
  },

  /* ------------------------- подготовка демо-пространства -------------------- */
  setup: {
    prepareDemoSpace: (teamIds: TeamId[]): Promise<XlWorkspaceInfo> =>
      isMockMode()
        ? mockBackend.prepareDemoSpace(teamIds)
        : http.post<XlWorkspaceInfo>('/setup/demo-space', { teamIds }),
  },

  /* ------------------------------ синхронизация ------------------------------ */
  sync: {
    log: (
      projectId: string,
      module: string,
      action: string,
      ok = true,
      payload?: Record<string, unknown>,
      error?: string,
    ): XlSyncLogEntry => mockBackend.logSync(projectId, module, action, ok, payload, error),

    history: (): Promise<XlSyncLogEntry[]> => mockBackend.syncLog(),

    reset: (): Promise<void> => mockBackend.resetMock(),
  },
};

export type ApiClient = typeof api;
export default api;
