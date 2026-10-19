/**
 * taskActions.ts — действия решения по карточке с задачами и ресурсами X-Lance.
 *
 * Действия описаны в колоде (`variant.actions`, см. data/deck.ts и XlAction):
 *
 *   • duration       — длительность задачи (через taskDuration.ts);
 *   • extendProject  — продление проекта (последняя задача) по запросу на изменение;
 *   • addTask        — новая задача: перед якорем (срок растёт) или параллельно ему;
 *   • labor          — трудозатраты ресурса на задаче (экономия/доп. работа штатного
 *                      сотрудника; X-Lance сам пересчитает себестоимость по ставке);
 *   • reassign       — передать работу на задаче другому исполнителю;
 *   • manual         — шаг без API: не выполняется, только попадает в журнал.
 *
 * Каждое действие перечитывает задачи: соседние изменения сдвигают версии и даты.
 */
import { loadProvisionResult } from './provision';
import { changeTaskDurationViaXl, normalizeTaskName, toAssignmentInputs, toPredecessorInputs, withUnits } from './taskDuration';
import {
  createProjectResource,
  createResource,
  createTask,
  projectResources,
  task as fetchTask,
  tasks as fetchTasks,
  updateTask,
  type AssignmentInput,
  type TaskInfo,
} from './graphqlApi';
import type { TeamId } from '../data/projects';
import type { XlAction } from '../game/types';

const HOURS_PER_DAY = 8;

export interface ActionResult {
  action: XlAction;
  ok: boolean;
  /** Действие не выполнялось: ручной шаг или уже применено ранее */
  skipped?: boolean;
  /** Что сделано (для журнала) */
  message?: string;
  error?: string;
}

/** Короткое описание действия для журнала. */
export function describeAction(action: XlAction): string {
  switch (action.type) {
    case 'duration':
      return `длительность «${action.task}» ${action.days > 0 ? '+' : ''}${action.days} дн.`;
    case 'extendProject':
      return `срок проекта +${action.days} дн.`;
    case 'addTask':
      return `новая задача «${action.name}» (${action.days} дн., ${
        action.placement === 'before' ? 'перед' : 'параллельно'
      } «${action.anchor}»)`;
    case 'labor':
      return `трудозатраты «${action.resource}» на «${action.task}» ${action.days > 0 ? '+' : ''}${action.days} чел.-дн.`;
    case 'reassign':
      return `«${action.task}»: «${action.from}» → «${action.to}»`;
    case 'manual':
      return `вручную: ${action.text}`;
  }
}

interface Context {
  tenantId: string;
  projectId: string;
  /** Нормализованное имя ресурса → id (ресурсы, подключённые к проекту) */
  resources: Map<string, string>;
}

async function loadTask(ctx: Context, name: string): Promise<TaskInfo> {
  const list = await fetchTasks(ctx.tenantId, ctx.projectId);
  const found = list.find((t) => normalizeTaskName(t.name) === normalizeTaskName(name));
  if (!found) throw new Error(`В проекте нет задачи «${name}»`);
  // перечитываем: версии после соседних изменений
  return (await fetchTask(ctx.tenantId, found.id)) ?? found;
}

function resourceId(ctx: Context, name: string): string {
  const id = ctx.resources.get(normalizeTaskName(name));
  if (!id) throw new Error(`Ресурс «${name}» не подключён к проекту`);
  return id;
}

/** Ресурс проекта по имени; если его нет — создаём человека без ставки (оплата платежом). */
async function ensureResource(ctx: Context, name: string): Promise<string> {
  const key = normalizeTaskName(name);
  const existing = ctx.resources.get(key);
  if (existing) return existing;
  const resource = await createResource({
    tenantId: ctx.tenantId,
    resourceType: 'HUMAN',
    firstName: name,
    lastName: '',
  });
  await createProjectResource({ tenantId: ctx.tenantId, projectId: ctx.projectId, resourceId: resource.id });
  ctx.resources.set(key, resource.id);
  return resource.id;
}

async function saveAssignments(ctx: Context, task: TaskInfo, assignments: AssignmentInput[]) {
  await updateTask({
    tenantId: ctx.tenantId,
    id: task.id,
    projectId: ctx.projectId,
    contentVersion: task.contentVersion ?? 0,
    scheduleVersion: task.scheduleVersion ?? 0,
    assignments: withUnits(assignments, task.duration),
    predecessors: toPredecessorInputs(task),
  });
}

async function runOne(ctx: Context, teamId: TeamId, action: XlAction): Promise<Omit<ActionResult, 'action'>> {
  switch (action.type) {
    case 'manual':
      return { ok: true, skipped: true, message: 'выполнить вручную' };

    case 'duration':
    case 'extendProject': {
      const r = await changeTaskDurationViaXl(
        teamId,
        action.type === 'duration' ? action.task : null,
        action.days,
      );
      return { ok: r.changed, message: r.taskName ? `«${r.taskName}» → ${r.duration} дн.` : undefined, error: r.changed ? undefined : r.reason };
    }

    case 'labor': {
      const task = await loadTask(ctx, action.task);
      const rid = resourceId(ctx, action.resource);
      const assignments = toAssignmentInputs(task);
      const current = assignments.find((a) => a.resourceId === rid);
      if (!current) {
        // доп. работа ресурса, которого нет на задаче (например, на вехе) — назначаем его
        if (action.days <= 0) throw new Error(`«${action.resource}» не назначен на «${action.task}»`);
        const work = action.days * HOURS_PER_DAY;
        await saveAssignments(ctx, task, [...assignments, { resourceId: rid, planWork: work }]);
        return { ok: true, message: `назначен, ${action.days} чел.-дн.` };
      }
      const work = (current.planWork ?? 0) + action.days * HOURS_PER_DAY;
      const next =
        work > 0
          ? assignments.map((a) => (a === current ? { resourceId: rid, planWork: work } : a))
          : assignments.filter((a) => a !== current);
      await saveAssignments(ctx, task, next);
      return { ok: true, message: work > 0 ? `${work / HOURS_PER_DAY} чел.-дн.` : 'снят с задачи' };
    }

    case 'reassign': {
      const task = await loadTask(ctx, action.task);
      const fromId = resourceId(ctx, action.from);
      const toId = await ensureResource(ctx, action.to);
      const assignments = toAssignmentInputs(task);
      const from = assignments.find((a) => a.resourceId === fromId);
      if (!from) {
        const already = assignments.some((a) => a.resourceId === toId);
        if (already) return { ok: true, skipped: true, message: 'уже переназначено' };
        throw new Error(`«${action.from}» не назначен на «${action.task}»`);
      }
      const work = from.planWork ?? 0;
      const rest = assignments.filter((a) => a !== from);
      const to = rest.find((a) => a.resourceId === toId);
      const next = to
        ? rest.map((a) => (a === to ? { resourceId: toId, planWork: (a.planWork ?? 0) + work } : a))
        : [...rest, { resourceId: toId, planWork: work }];
      await saveAssignments(ctx, task, next);
      return { ok: true, message: `${work / HOURS_PER_DAY} чел.-дн. → «${action.to}»` };
    }

    case 'addTask': {
      const list = await fetchTasks(ctx.tenantId, ctx.projectId);
      if (list.some((t) => normalizeTaskName(t.name) === normalizeTaskName(action.name))) {
        return { ok: true, skipped: true, message: 'задача уже есть' };
      }
      const anchor = await loadTask(ctx, action.anchor);
      const assignments: AssignmentInput[] = [];
      for (const a of action.assign ?? []) {
        assignments.push({ resourceId: await ensureResource(ctx, a.resource), planWork: a.days * HOURS_PER_DAY });
      }
      const created = await createTask({
        tenantId: ctx.tenantId,
        projectId: ctx.projectId,
        objectTypeId: anchor.objectTypeId,
        name: action.name,
        statusId: anchor.statusId ?? undefined,
        startDate: anchor.startDate?.slice(0, 10) ?? undefined,
        duration: action.days,
        predecessors: toPredecessorInputs(anchor),
        assignments: withUnits(assignments, action.days),
      });
      if (action.placement === 'before') {
        // якорь теперь ждёт новую задачу: срок проекта растёт на её длительность
        const fresh = (await fetchTask(ctx.tenantId, anchor.id)) ?? anchor;
        await updateTask({
          tenantId: ctx.tenantId,
          id: fresh.id,
          projectId: ctx.projectId,
          contentVersion: fresh.contentVersion ?? 0,
          scheduleVersion: fresh.scheduleVersion ?? 0,
          assignments: toAssignmentInputs(fresh),
          predecessors: [{ predecessorId: created.id, type: 'FS', lag: 0 }],
        });
      }
      return { ok: true, message: `создана задача ${created.code || created.id}` };
    }
  }
}

/** Выполнить в X-Lance действия выбранного варианта карточки. */
export async function runCardActions(teamId: TeamId, actions: XlAction[]): Promise<ActionResult[]> {
  if (actions.length === 0) return [];
  const provision = loadProvisionResult();
  const team = provision?.teams.find((t) => t.teamId === teamId);
  if (!provision || !team) {
    return actions.map((action) =>
      action.type === 'manual'
        ? { action, ok: true, skipped: true, message: 'выполнить вручную' }
        : { action, ok: false, error: 'Игра не развёрнута в X-Lance — нет данных провижининга' },
    );
  }

  const links = await projectResources(provision.tenantId, team.projectId);
  const ctx: Context = {
    tenantId: provision.tenantId,
    projectId: team.projectId,
    resources: new Map(
      links
        .filter((l) => l.resource?.name)
        .map((l) => [normalizeTaskName(l.resource!.name), l.resourceId] as [string, string]),
    ),
  };

  const results: ActionResult[] = [];
  for (const action of actions) {
    try {
      results.push({ action, ...(await runOne(ctx, teamId, action)) });
    } catch (error) {
      results.push({ action, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
