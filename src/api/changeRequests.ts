/**
 * changeRequests.ts — запросы на изменение объёма работ.
 *
 * В X-Lance отдельной сущности «запрос на изменение» нет (см. schema.json),
 * поэтому запрос оформляется и согласуется в игре, а само действие фиксируется
 * в журнале. Пересмотр плана при этом выполняется правкой длительности задачи
 * в X-Lance (`updateTask`) в момент решения команды.
 *
 * Оформленные за время сессии запросы хранятся в памяти вкладки.
 */
import { journalLog } from './journal';
import type { XlChangeRequest } from './types';
import type { TeamId } from '../data/projects';

export interface ChangeRequestPayload {
  projectId: TeamId;
  cardId: string;
  cardTitle: string;
  optionTitle: string;
  deltaDays: number;
  deltaCost: number;
  deltaIncome: number;
}

const requests = new Map<string, XlChangeRequest>();

let counter = 0;
const newId = (): string => `xl-cr-${Date.now().toString(36)}-${++counter}`;

function payloadLog(payload: ChangeRequestPayload): Record<string, unknown> {
  return {
    days: payload.deltaDays,
    cost: payload.deltaCost,
    income: payload.deltaIncome,
  };
}

/** Оформить запрос на изменение. */
export async function createChangeRequest(payload: ChangeRequestPayload): Promise<XlChangeRequest> {
  const request: XlChangeRequest = {
    ...payload,
    id: newId(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  requests.set(request.id, request);
  journalLog(
    payload.projectId,
    'change-requests',
    `Запрос на изменение: «${payload.cardTitle}» — ${payload.optionTitle}`,
    true,
    payloadLog(payload),
  );
  return request;
}

/** Утвердить запрос на изменение (Заказчик — фасилитатор). */
export async function approveChangeRequest(id: string, comment?: string): Promise<XlChangeRequest> {
  const request = requests.get(id);
  if (request) {
    request.status = 'approved';
    request.decidedAt = new Date().toISOString();
    request.approver = 'Заказчик (фасилитатор)';
    request.comment = comment;
    journalLog(request.projectId, 'approvals', `Запрос на изменение утверждён: ${id}`, true, { comment });
    return request;
  }
  journalLog('', 'approvals', `Запрос на изменение утверждён: ${id}`, false, undefined, 'Запрос не найден в сессии');
  return {
    id,
    projectId: '',
    cardId: '',
    cardTitle: '',
    optionTitle: '',
    deltaDays: 0,
    deltaCost: 0,
    deltaIncome: 0,
    status: 'approved',
    createdAt: new Date().toISOString(),
    decidedAt: new Date().toISOString(),
    approver: 'Заказчик (фасилитатор)',
    comment,
  };
}

/** Отклонить запрос на изменение. */
export async function rejectChangeRequest(id: string, comment?: string): Promise<XlChangeRequest> {
  const request = requests.get(id);
  if (request) {
    request.status = 'rejected';
    request.decidedAt = new Date().toISOString();
    request.approver = 'Заказчик (фасилитатор)';
    request.comment = comment;
    journalLog(request.projectId, 'approvals', `Запрос на изменение отклонён: ${id}`, true, { comment });
    return request;
  }
  journalLog('', 'approvals', `Запрос на изменение отклонён: ${id}`, false, undefined, 'Запрос не найден в сессии');
  return {
    id,
    projectId: '',
    cardId: '',
    cardTitle: '',
    optionTitle: '',
    deltaDays: 0,
    deltaCost: 0,
    deltaIncome: 0,
    status: 'rejected',
    createdAt: new Date().toISOString(),
    decidedAt: new Date().toISOString(),
    approver: 'Заказчик (фасилитатор)',
    comment,
  };
}

/** Запросы на изменение, оформленные за текущую сессию. */
export function listChangeRequests(projectId?: TeamId): XlChangeRequest[] {
  const all = [...requests.values()];
  return projectId ? all.filter((r) => r.projectId === projectId) : all;
}
