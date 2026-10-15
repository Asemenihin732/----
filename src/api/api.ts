/**
 * api.ts — клиент X-Lance для игры.
 *
 *   • Изменение данных (длительность задачи, запрос на изменение) выполняется
 *     через GraphQL-мутации X-Lance.
 *   • Чтение справочных разделов (проекты, планы, Ганта, ресурсы, финансы,
 *     показатели, отчёты) идёт по REST-эндпоинтам разделов 6–11 методички
 *     (`http.ts`, Bearer-токен).
 *
 * При появлении актуальной спецификации GraphQL для разделов чтения —
 * правится только соответствующая ветка методов.
 */
import { apiConfig, configWarnings } from './config';
import { http } from './http';
import {
  approveChangeRequest,
  createChangeRequest,
  rejectChangeRequest,
  type ChangeRequestPayload,
} from './changeRequests';
import { changeTaskDurationViaXl } from './taskDuration';
import type {
  DeviationRow,
  DurationChangeResult,
  XlBaselinePlan,
  XlChangeRequest,
  XlCompetence,
  XlFinance,
  XlGanttTask,
  XlIndicator,
  XlPaymentItem,
  XlProject,
  XlResource,
} from './types';
import type { TeamId } from '../data/projects';

export type { DeviationRow, XlProject, XlChangeRequest, XlIndicator };

/* --------------------------------- клиент ---------------------------------- */

export const api = {
  /** Диагностика конфигурации */
  meta: {
    baseUrl: apiConfig.baseUrl,
    warnings: configWarnings(),
  },

  /* --------------------------------- проекты -------------------------------- */
  projects: {
    list: (): Promise<XlProject[]> => http.get<XlProject[]>('/projects'),

    get: (id: string): Promise<XlProject> => http.get<XlProject>(`/projects/${id}`),

    create: (teamId: TeamId, name?: string): Promise<XlProject> =>
      http.post<XlProject>('/projects', { teamId, name }),
  },

  /* ------------------------------ базовый план ------------------------------- */
  plans: {
    baseline: (projectId: TeamId): Promise<XlBaselinePlan> =>
      http.get<XlBaselinePlan>(`/projects/${projectId}/baseline`),

    update: (projectId: TeamId, works: XlBaselinePlan['works']): Promise<XlBaselinePlan> =>
      http.patch<XlBaselinePlan>(`/projects/${projectId}/baseline`, { works }),
  },

  /* ---------------------------- диаграмма Ганта ------------------------------ */
  gantt: {
    tasks: (projectId: TeamId): Promise<XlGanttTask[]> =>
      http.get<XlGanttTask[]>(`/projects/${projectId}/gantt`),

    shiftTask: (projectId: TeamId, taskId: string, days: number): Promise<XlGanttTask> =>
      http.patch<XlGanttTask>(`/projects/${projectId}/gantt/${taskId}`, { shiftDays: days }),

    recalc: (projectId: TeamId): Promise<XlGanttTask[]> =>
      http.post<XlGanttTask[]>(`/projects/${projectId}/gantt/recalc`),
  },

  /* --------------------------------- задачи ---------------------------------- */
  tasks: {
    /** Изменить длительность задачи работ (решение команды по карточке) — `updateTask` в X-Lance. */
    changeDuration: (teamId: TeamId, taskName: string | null, deltaDays: number): Promise<DurationChangeResult> =>
      changeTaskDurationViaXl(teamId, taskName, deltaDays),
  },

  /* -------------------------------- ресурсы ---------------------------------- */
  resources: {
    list: (projectId: TeamId): Promise<XlResource[]> =>
      http.get<XlResource[]>(`/projects/${projectId}/resources`),

    replace: (projectId: TeamId, resourceId: string, newName: string): Promise<XlResource> =>
      http.patch<XlResource>(`/projects/${projectId}/resources/${resourceId}`, { name: newName, assignment: 'Замена' }),

    setRate: (projectId: TeamId, resourceId: string, rate: number): Promise<XlResource> =>
      http.patch<XlResource>(`/projects/${projectId}/resources/${resourceId}`, { rate }),

    matrix: (projectId: TeamId): Promise<XlCompetence[]> =>
      http.get<XlCompetence[]>(`/projects/${projectId}/competences`),
  },

  /* -------------------------- запросы на изменение --------------------------- */
  changeRequests: {
    create: (payload: ChangeRequestPayload): Promise<XlChangeRequest> => createChangeRequest(payload),

    approve: (id: string, comment?: string): Promise<XlChangeRequest> => approveChangeRequest(id, comment),

    reject: (id: string, comment?: string): Promise<XlChangeRequest> => rejectChangeRequest(id, comment),
  },

  /* --------------------------------- финансы --------------------------------- */
  finance: {
    get: (projectId: TeamId): Promise<XlFinance> =>
      http.get<XlFinance>(`/projects/${projectId}/finance`),

    addExpense: (projectId: TeamId, item: string, amount: number): Promise<XlFinance> =>
      http.post<XlFinance>(`/projects/${projectId}/finance/expenses`, { item, amount }),

    addIncome: (projectId: TeamId, item: string, amount: number): Promise<XlFinance> =>
      http.post<XlFinance>(`/projects/${projectId}/finance/income`, { item, amount }),

    paymentCalendar: (projectId: TeamId): Promise<XlPaymentItem[]> =>
      http.get<XlPaymentItem[]>(`/projects/${projectId}/payments`),
  },

  /* ------------------------- пользовательские показатели --------------------- */
  indicators: {
    /** «Удовлетворённость заказчика» — показатель с коридором 40–130% */
    list: (projectId: TeamId): Promise<XlIndicator[]> =>
      http.get<XlIndicator[]>(`/projects/${projectId}/indicators`),

    setValue: (projectId: TeamId, key: string, value: number): Promise<XlIndicator> =>
      http.patch<XlIndicator>(`/projects/${projectId}/indicators/${key}`, { value }),
  },

  /* ---------------------------------- отчёты --------------------------------- */
  reports: {
    /** Отчёт по отклонениям сразу по всем проектам */
    deviations: (): Promise<DeviationRow[]> => http.get<DeviationRow[]>('/reports/deviations'),

    status: (projectId: TeamId): Promise<Record<string, unknown>> =>
      http.get<Record<string, unknown>>(`/projects/${projectId}/status`),

    bi: (): Promise<{ index: number; teams: DeviationRow[] }> =>
      http.get<{ index: number; teams: DeviationRow[] }>('/reports/bi'),
  },
};

export type ApiClient = typeof api;
export default api;
