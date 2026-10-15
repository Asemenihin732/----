/**
 * taskDuration.ts — изменение длительности задачи работ прямо в X-Lance (GraphQL).
 *
 * Используется в http-режиме при решении команды по карточке: находим задачу
 * проекта по имени из колоды (`deltaDays.taskName`), перечитываем её версии
 * и отправляем `updateTask` с новой длительностью. X-Lance сам пересчитает
 * даты и связи.
 *
 * Если конкретной задачи нет (например, вариант «Запрос на изменение») —
 * продлеваем проект целиком: берём задачу, заканчивающуюся позже всех.
 */
import { getPlan } from '../data/plan';
import type { TeamId } from '../data/projects';
import { loadProvisionResult } from './provision';
import {
  task as fetchTask,
  tasks as fetchTasks,
  updateTask,
  type AssignmentInput,
  type PredecessorInput,
  type TaskInfo,
} from './graphqlApi';
import type { DurationChangeResult } from './types';

/** Имена-заглушки: «запрос на изменение» не является задачей плана. */
const PLACEHOLDER_TASK_NAMES = new Set(['запрос на изменение']);

/** Нормализованное имя задачи: регистр, «ё», кавычки, кратные пробелы. */
export const normalizeTaskName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"']/g, '')
    .replace(/\s+/g, ' ');

/** Задача, заканчивающаяся позже всех (конец проекта). */
function lastEndingTask(list: TaskInfo[]): TaskInfo | undefined {
  return [...list].sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''))[0];
}

/** Найти задачу проекта по имени из карточки. */
function findTaskByName(list: TaskInfo[], taskName: string | null): TaskInfo | undefined {
  const norm = taskName ? normalizeTaskName(taskName) : '';
  if (!norm || PLACEHOLDER_TASK_NAMES.has(norm)) return undefined;
  const exact = list.find((t) => normalizeTaskName(t.name) === norm);
  if (exact) return exact;
  return list.find(
    (t) => normalizeTaskName(t.name).includes(norm) || norm.includes(normalizeTaskName(t.name)),
  );
}

const HOURS_PER_DAY = 8;

/**
 * Загрузка (`units`, %) под заданную работу и длительность. X-Lance при смене
 * длительности держит загрузку и пересчитывает от неё работу (8 ч × 100% на 2 дня
 * = 16 ч — стоимость растёт). Передавая загрузку явно, сохраняем работу:
 * 8 ч на 2 дня = 50%. Проверено на dev-стенде.
 */
export function withUnits(assignments: AssignmentInput[], durationDays: number | null | undefined): AssignmentInput[] {
  return assignments.map((a) => ({
    resourceId: a.resourceId,
    planWork: a.planWork,
    units:
      durationDays && durationDays > 0 && a.planWork !== undefined
        ? (a.planWork / (durationDays * HOURS_PER_DAY)) * 100
        : undefined,
  }));
}

/** Назначения задачи в формате входа `updateTask` с загрузкой под её длительность. */
export function toAssignmentInputs(task: TaskInfo, durationDays = task.duration): AssignmentInput[] {
  return withUnits(
    (task.assignments ?? []).map((a) => ({ resourceId: a.resourceId, planWork: a.planWork ?? undefined })),
    durationDays,
  );
}

/** Предшественники задачи в формате входа `updateTask` (без изменений). */
export function toPredecessorInputs(task: TaskInfo): PredecessorInput[] {
  return (task.predecessors ?? []).map((p) => ({
    predecessorId: p.predecessorId,
    type: p.type,
    lag: p.lag ?? undefined,
  }));
}

/**
 * Изменить длительность задачи работ в X-Lance на `deltaDays` дней.
 * Возвращает описание применённого изменения либо причину отказа.
 */
export async function changeTaskDurationViaXl(
  teamId: TeamId,
  taskName: string | null,
  deltaDays: number,
): Promise<DurationChangeResult> {
  if (!deltaDays) return { changed: false, reason: 'Изменение длительности не требуется' };

  const provision = loadProvisionResult();
  const team = provision?.teams.find((t) => t.teamId === teamId);
  if (!provision || !team) {
    return { changed: false, reason: 'Игра не развёрнута в X-Lance — нет данных провижининга' };
  }

  const list = await fetchTasks(provision.tenantId, team.projectId);
  if (list.length === 0) return { changed: false, reason: 'В проекте X-Lance нет задач' };

  const named = Boolean(taskName && !PLACEHOLDER_TASK_NAMES.has(normalizeTaskName(taskName)));
  const byName = findTaskByName(list, taskName);
  const target = byName ?? lastEndingTask(list);
  if (!target) return { changed: false, reason: 'Не удалось определить задачу для изменения' };

  // Перечитываем задачу: соседние обновления могли сменить версии.
  const fresh = (await fetchTask(provision.tenantId, target.id)) ?? target;

  const planDuration = getPlan(teamId).tasks.find(
    (t) => normalizeTaskName(t.name) === normalizeTaskName(fresh.name),
  )?.durationDays;
  const current = typeof fresh.duration === 'number' ? fresh.duration : planDuration ?? 1;
  const next = Math.max(0.5, current + deltaDays);

  await updateTask({
    tenantId: provision.tenantId,
    id: fresh.id,
    projectId: team.projectId,
    contentVersion: fresh.contentVersion ?? 0,
    scheduleVersion: fresh.scheduleVersion ?? 0,
    duration: next,
    assignments: toAssignmentInputs(fresh, next),
    predecessors: toPredecessorInputs(fresh),
  });

  return {
    changed: true,
    taskId: fresh.id,
    taskName: fresh.name,
    duration: next,
    reason: !named
      ? 'Задача не указана — продлён конец проекта'
      : byName
        ? undefined
        : 'Задача по имени не найдена — продлён конец проекта',
  };
}
