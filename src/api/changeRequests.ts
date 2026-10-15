/**
 * changeRequests.ts — запросы на изменение объёма работ.
 *
 * В демо-режиме запросы живут в mock-БД (создание, согласование Заказчиком).
 * В X-Lance отдельной сущности «запрос на изменение» нет (см. schema.json),
 * поэтому в http-режиме решение фиксируется документарно — записями в журнале,
 * а пересмотр плана и бюджета происходит правками задач/показателей.
 */
import { isMockMode } from './config';
import { mockBackend } from './mockBackend';
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

const newId = (): string => `xl-cr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Оформить запрос на изменение. */
export async function createChangeRequest(payload: ChangeRequestPayload): Promise<XlChangeRequest> {
  if (isMockMode()) return mockBackend.createChangeRequest(payload);
  const request: XlChangeRequest = {
    ...payload,
    id: newId(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  mockBackend.logSync(
    payload.projectId,
    'change-requests',
    `Запрос на изменение: «${payload.cardTitle}» — ${payload.optionTitle}`,
    true,
    { deltaDays: payload.deltaDays, deltaCost: payload.deltaCost, deltaIncome: payload.deltaIncome },
  );
  return request;
}

/** Утвердить запрос на изменение (Заказчик — фасилитатор). */
export async function approveChangeRequest(id: string, comment?: string): Promise<XlChangeRequest> {
  if (isMockMode()) return mockBackend.approveChangeRequest(id, comment);
  const approved: XlChangeRequest = {
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
  mockBackend.logSync('', 'approvals', `Запрос на изменение утверждён: ${id}`, true, { comment });
  return approved;
}

/** Отклонить запрос на изменение. */
export async function rejectChangeRequest(id: string, comment?: string): Promise<XlChangeRequest> {
  if (isMockMode()) return mockBackend.rejectChangeRequest(id, comment);
  const rejected: XlChangeRequest = {
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
  mockBackend.logSync('', 'approvals', `Запрос на изменение отклонён: ${id}`, true, { comment });
  return rejected;
}
