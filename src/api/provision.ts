/**
 * provision.ts — инициализация игрового пространства в X-Lance.
 *
 * Последовательность:
 *   1. me()                    — текущий пользователь
 *   2. ensureTenant()          — найти/создать тенант
 *   3. myAccess()              — проверить права
 *   4. objectTypes/Statuses    — взять дефолтные справочники тенанта
 *   5. resources()             — найти cвой человеко-ресурс (менеджер)
 *   6. на каждую команду       — createProject, ресурсы и задачи из плана
 *                                (X-Lance_Plany_rabot.xlsx): задачи проекта
 *                                (без родителя), связи предшествования и трудозатраты
 *
 * Повторный запуск не дублирует данные: тенант и проекты переиспользуются
 * по имени и коду. Переиспользованный проект возвращается к исходному
 * состоянию: задачи приводятся к плану (длительность, даты, связи, назначения),
 * задачи вне плана удаляются, ресурсы вне плана (например, нанятый по карточке
 * фрилансер) отключаются от проекта, все платежи удаляются и создаются заново
 * базовые: расходы из плана работ и «Оплата по договору».
 */
import { getPlan, type PlannerSheet, type PlannerTask } from '../data/plan';
import { getProject, type TeamId } from '../data/projects';
import { fetchMe, type Account } from './authStore';
import {
  costRates,
  createCostRate,
  createProject,
  createProjectResource,
  createResource,
  createTask,
  deleteProjectResource,
  deleteTask,
  ensureTenant,
  myAccess,
  objectStatuses,
  objectTypes,
  pickObjectType,
  pickStartStatus,
  projectResources,
  projects as fetchProjects,
  resources as fetchResources,
  task as fetchTask,
  tasks as fetchTasks,
  updateCostRate,
  updateTask,
  type MyAccess,
  type PredecessorInput,
  type ProjectInfo,
  type ResourceInfo,
  type TaskInfo,
  type Tenant,
} from './graphqlApi';
import { GraphqlError } from './graphql';
import { clearProjectPayments, createBasePayments, ensurePaymentType } from './paymentSync';
import { withUnits } from './taskDuration';

/* --------------------------------- результат -------------------------------- */

export interface TeamProvisionResult {
  teamId: string;
  projectId: string;
  code: string;
  name: string;
  /** Задачи работ плана — самостоятельные задачи проекта (без родителя). */
  taskIds: string[];
  resourceIds: string[];
  reusedProject: boolean;
  /** Удалено при сбросе: задачи вне плана и платежи (нет в результатах старых версий) */
  removedTaskCount?: number;
  removedPaymentCount?: number;
  /** Создано базовых платежей: расходы плана и оплата по договору */
  basePaymentCount?: number;
}

export interface ProvisionResult {
  tenantId: string;
  tenantName: string;
  tenantKey: string;
  createdTenant: boolean;
  managerResourceId: string | null;
  teams: TeamProvisionResult[];
  taskCount: number;
  resourceCount: number;
  startedAt: string;
  finishedAt: string;
}

const PROVISION_KEY = 'xlance-provision-v1';

export function loadProvisionResult(): ProvisionResult | null {
  try {
    const raw = localStorage.getItem(PROVISION_KEY);
    return raw ? (JSON.parse(raw) as ProvisionResult) : null;
  } catch {
    return null;
  }
}

export function saveProvisionResult(result: ProvisionResult): void {
  try {
    localStorage.setItem(PROVISION_KEY, JSON.stringify(result));
  } catch {
    /* ignore */
  }
}

export function clearProvisionResult(): void {
  try {
    localStorage.removeItem(PROVISION_KEY);
  } catch {
    /* ignore */
  }
}

/* --------------------------------- утилиты ---------------------------------- */

/** Часов в рабочем дне: X-Lance измеряет трудозатраты (`planWork`) в часах. */
const HOURS_PER_DAY = 8;

/** Код проекта из id команды: catering → CATERING. */
function teamCode(teamId: string): string {
  const base = teamId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return base.slice(0, 12) || 'TEAM';
}

/* --------------------------------- провижининг ------------------------------- */

export interface ProvisionOptions {
  /** Имя тенанта; совпадает с существующим — он переиспользуется. */
  tenantName: string;
  /** Ключ тенанта для создания нового (сокращение из 2–4 букв). */
  tenantKey?: string;
  /** Команды, которые нужно развернуть. */
  teamIds: TeamId[];
  /** Ресурс-менеджер проектов; по умолчанию — свой ресурс или создаётся. */
  managerId?: string;
  /** День 1 планов (ISO, YYYY-MM-DD). По умолчанию — сегодня. */
  startDate?: string;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Развёртывание отменено');
}

/** Найти свой человеко-ресурс в тенанте или создать его. */
async function ensureSelfResource(
  tenant: Tenant,
  access: MyAccess,
  me: Account,
  existing: ResourceInfo[],
): Promise<ResourceInfo | null> {
  const byAccess = access.resourceId ? existing.find((r) => r.id === access.resourceId) : undefined;
  if (byAccess) return byAccess;
  const byAccount = existing.find((r) => r.accountId === me.id);
  if (byAccount) return byAccount;
  if (!me.firstName && !me.lastName) return null;
  return createResource({
    tenantId: tenant.id,
    resourceType: 'HUMAN',
    firstName: me.firstName || me.email,
    lastName: me.lastName || '',
    email: me.email,
  });
}

/** Нормализованное имя ресурса для сравнения (без учёта регистра и краевых пробелов). */
const normalizeName = (name: string): string => name.trim().toLowerCase();

/** Ресурс, уже подключённый к проекту. */
interface LinkedResource {
  id: string;
  resourceType: string;
}

/**
 * Проставить стоимость трудового ресурса. В плане ставка задана за день,
 * а X-Lance считает стоимость за час (`planWork` — в часах), поэтому делим
 * на число часов в рабочем дне. Для существующих ресурсов проверяем ставку
 * и приводим её к плану.
 */
async function ensureHumanCostRate(
  tenantId: string,
  resourceId: string,
  dailyRate: number,
  effectiveFrom: string,
  created: boolean,
): Promise<void> {
  const hourly = dailyRate / HOURS_PER_DAY;
  if (!created) {
    const existing = await costRates(tenantId, resourceId);
    const current = existing.find((r) => r.isCurrent) ?? existing[0];
    if (current) {
      if (current.amount !== hourly) {
        await updateCostRate({ tenantId, id: current.id, amount: hourly });
      }
      return;
    }
  }
  await createCostRate({ tenantId, resourceId, amount: hourly, effectiveFrom });
}

/**
 * Создать ресурсы команды по таблице ресурсов плана, подключить их к проекту
 * и задать стоимость трудовых ресурсов (ставку в день).
 * Идемпотентно: ресурсы, уже присутствующие в проекте (по имени), пропускаются,
 * но при необходимости им доставляется недостающая ставка.
 * Возвращает id ресурсов и карту «нормализованное имя → id» для назначений.
 */
async function provisionResources(
  tenant: Tenant,
  plan: PlannerSheet,
  projectId: string,
  startDate: string,
  existingByName: Map<string, LinkedResource>,
  onProgress: (message: string) => void,
  signal?: AbortSignal,
): Promise<{ ids: string[]; byName: Map<string, string> }> {
  const ids: string[] = [];
  const byName = new Map<string, string>();
  for (const item of plan.resources) {
    assertNotAborted(signal);
    const key = normalizeName(item.name);
    const existing = existingByName.get(key);
    if (existing) {
      onProgress(`Ресурс «${item.name}» уже в проекте — пропускаем`);
      if (item.kind === 'HUMAN' && existing.resourceType.toUpperCase() === 'HUMAN') {
        await ensureHumanCostRate(tenant.id, existing.id, item.ratePerDay ?? item.cost, startDate, false);
      }
      ids.push(existing.id);
      byName.set(key, existing.id);
      continue;
    }
    onProgress(`Ресурс «${item.name}» (${item.kind === 'HUMAN' ? 'человек' : 'материал'})`);
    const resource =
      item.kind === 'HUMAN'
        ? await createResource({
            tenantId: tenant.id,
            resourceType: 'HUMAN',
            firstName: item.name,
            lastName: '',
          })
        : await createResource({ tenantId: tenant.id, resourceType: 'MATERIAL', name: item.name });
    await createProjectResource({ tenantId: tenant.id, projectId, resourceId: resource.id });
    if (item.kind === 'HUMAN') {
      await ensureHumanCostRate(tenant.id, resource.id, item.ratePerDay ?? item.cost, startDate, true);
    }
    ids.push(resource.id);
    byName.set(key, resource.id);
  }
  return { ids, byName };
}

/** Предшественники задачи из плана → вход GraphQL. */
function buildPredecessors(task: PlannerTask, idByNo: Map<number, string>): PredecessorInput[] {
  const result: PredecessorInput[] = [];
  for (const pred of task.predecessors) {
    const predecessorId = idByNo.get(pred.no);
    if (predecessorId) result.push({ predecessorId, type: pred.type, lag: pred.lag });
  }
  return result;
}

/**
 * Назначения ресурсов на задачу. X-Lance сам рассчитывает загрузку (`units`)
 * из трудозатрат (`planWork`, часы) и длительности задачи, поэтому передаём
 * только ресурс и трудозатраты. В плане трудозатраты заданы в человеко-днях,
 * переводим их в часы.
 */
function buildAssignments(
  task: PlannerTask,
  resourceByName: Map<string, string>,
): { resourceId: string; planWork: number }[] {
  const result: { resourceId: string; planWork: number }[] = [];
  for (const assignment of task.assignments) {
    const resourceId = resourceByName.get(normalizeName(assignment.resource));
    if (!resourceId) continue;
    result.push({ resourceId, planWork: assignment.days * HOURS_PER_DAY });
  }
  return result;
}

/**
 * Создать (или привести к плану) задачи команды: работы плана — самостоятельные
 * задачи проекта (без родителя), со связями предшествования и назначениями
 * ресурсов. Даты рассчитывает X-Lance по длительности и связям.
 * Идемпотентно: существующая задача обновляется (связи, трудозатраты).
 * Устаревшая «главная» задача (с именем проекта) удаляется.
 */
async function provisionTasks(
  tenant: Tenant,
  plan: PlannerSheet,
  projectName: string,
  projectId: string,
  taskTypeId: string,
  taskStatusId: string | undefined,
  resourceByName: Map<string, string>,
  startDate: string,
  existingByName: Map<string, TaskInfo>,
  onProgress: (message: string) => void,
  signal?: AbortSignal,
): Promise<string[]> {
  // Убираем устаревшую главную (суммарную) задачу с именем проекта: задачи
  // проекта должны быть самостоятельными и связаны предшествованием.
  const legacyMain = existingByName.get(normalizeName(projectName));
  if (legacyMain) {
    onProgress(`Удаляем устаревшую главную задачу «${projectName}»`);
    await deleteTask({ tenantId: tenant.id, projectId, id: legacyMain.id });
    existingByName.delete(normalizeName(projectName));
  }

  const idByNo = new Map<number, string>();
  const taskIds: string[] = [];
  for (const task of plan.tasks) {
    assertNotAborted(signal);
    const predecessors = buildPredecessors(task, idByNo);
    // загрузку передаём явно: иначе при сбросе X-Lance оставит загрузку, изменённую
    // карточкой (например, 50%), и пересчитает от неё работу
    const assignments = withUnits(buildAssignments(task, resourceByName), task.durationDays);
    const existing = existingByName.get(normalizeName(task.name));
    let info: TaskInfo;
    if (existing) {
      onProgress(`Задача «${task.name}» — обновляем связи и трудозатраты`);
      // Перечитываем задачу: удаление главной задачи и пересчёт соседних
      // работ меняют scheduleVersion, поэтому версии нужны актуальные.
      const fresh = (await fetchTask(tenant.id, existing.id)) ?? existing;
      info = await updateTask({
        tenantId: tenant.id,
        id: fresh.id,
        projectId,
        contentVersion: fresh.contentVersion ?? 0,
        scheduleVersion: fresh.scheduleVersion ?? 0,
        parentId: null,
        duration: task.durationDays,
        startDate,
        predecessors,
        assignments,
      });
    } else {
      onProgress(`Задача «${task.name}»`);
      info = await createTask({
        tenantId: tenant.id,
        projectId,
        objectTypeId: taskTypeId,
        name: task.name,
        statusId: taskStatusId,
        startDate,
        duration: task.durationDays,
        predecessors,
        assignments,
      });
    }
    idByNo.set(task.no, info.id);
    taskIds.push(info.id);
  }
  return taskIds;
}

/** Развернуть тенант, проекты-команды, задачи и ресурсы в X-Lance. */
export async function provisionGame(options: ProvisionOptions): Promise<ProvisionResult> {
  const { tenantName, tenantKey, teamIds, onProgress = () => {}, signal } = options;
  const startedAt = new Date().toISOString();
  const startDate = options.startDate ?? new Date().toISOString().slice(0, 10);

  onProgress('Вход: проверяем пользователя…');
  assertNotAborted(signal);
  const me = await fetchMe();

  onProgress(`Тенант «${tenantName}»…`);
  assertNotAborted(signal);
  const { tenant, created: createdTenant } = await ensureTenant(tenantName, tenantKey);

  onProgress('Проверяем права доступа…');
  assertNotAborted(signal);
  const access = await myAccess(tenant.id);
  if (!access.isAdmin && !access.permissions.includes('tenant:projects:create')) {
    throw new Error('Недостаточно прав: нет tenant:projects:create в этом тенанте.');
  }

  onProgress('Справочники: типы и статусы объектов…');
  assertNotAborted(signal);
  const [types, statuses, existingProjects, existingResources] = await Promise.all([
    objectTypes(tenant.id),
    objectStatuses(tenant.id),
    fetchProjects(tenant.id),
    fetchResources(tenant.id),
  ]);

  const projectType = pickObjectType(types, 'PROJECT');
  const taskType = pickObjectType(types, 'TASK', true);
  if (!projectType) {
    throw new Error('В тенанте нет типа объекта класса PROJECT — разверните справочники в X-Lance.');
  }
  if (!taskType) {
    throw new Error('В тенанте нет типа объекта класса TASK — разверните справочники в X-Lance.');
  }
  const projectStartStatus = pickStartStatus(statuses, projectType.id);
  const taskStartStatus = pickStartStatus(statuses, taskType.id);

  onProgress('Ищем менеджера проектов…');
  assertNotAborted(signal);
  const selfResource =
    (options.managerId ? existingResources.find((r) => r.id === options.managerId) : undefined) ??
    (await ensureSelfResource(tenant, access, me, existingResources));
  const managerResourceId = selfResource?.id ?? null;

  // Типы входящих и исходящих платежей — чтобы карточки могли вносить оба вида.
  // На стендах без платежей шаг пропускается и развёртывание не падает.
  onProgress('Справочники: типы платежей…');
  try {
    await ensurePaymentType(tenant.id, 'EXPENSE');
    await ensurePaymentType(tenant.id, 'INCOME');
  } catch (error) {
    onProgress(`Типы платежей не подготовлены: ${error instanceof Error ? error.message : String(error)}`);
  }

  const teams: TeamProvisionResult[] = [];
  let taskCount = 0;
  let resourceCount = 0;

  for (const teamId of teamIds) {
    assertNotAborted(signal);
    const project = getProject(teamId);
    const code = teamCode(teamId);
    onProgress(`Команда «${project.shortName}»: проект ${code}…`);

    let projectInfo: ProjectInfo | undefined = existingProjects.find((p) => p.code === code);
    let reusedProject = Boolean(projectInfo);
    if (!projectInfo) {
      projectInfo = await createProject({
        tenantId: tenant.id,
        code,
        name: project.name,
        objectTypeId: projectType.id,
        statusId: projectStartStatus?.id,
        managerId: managerResourceId ?? undefined,
        startDate,
      });
      reusedProject = false;
    }

    const plan = getPlan(teamId);

    // Уже подключённые к проекту ресурсы — чтобы не дублировать при повторном запуске
    const linked = await projectResources(tenant.id, projectInfo.id);
    const linkedIds = new Set(linked.map((r) => r.resourceId));
    const linkedByName = new Map<string, LinkedResource>();
    for (const link of linked) {
      const name = normalizeName(link.resource?.name ?? '');
      if (name) linkedByName.set(name, { id: link.resourceId, resourceType: link.resourceType });
    }

    const resourceIds: string[] = [];
    if (managerResourceId) {
      if (!linkedIds.has(managerResourceId)) {
        try {
          await createProjectResource({
            tenantId: tenant.id,
            projectId: projectInfo.id,
            resourceId: managerResourceId,
          });
        } catch (error) {
          // createProject с managerId мог уже добавить менеджера автоматически
          if (!(error instanceof GraphqlError) || error.code !== 'INVALID_PROJECT_RESOURCE') throw error;
        }
      }
      resourceIds.push(managerResourceId);
    }
    const provisioned = await provisionResources(
      tenant,
      plan,
      projectInfo.id,
      startDate,
      linkedByName,
      onProgress,
      signal,
    );
    resourceIds.push(...provisioned.ids);
    resourceCount += resourceIds.length;

    const existingTasks = await fetchTasks(tenant.id, projectInfo.id);
    const existingTasksByName = new Map(existingTasks.map((t) => [normalizeName(t.name), t]));
    const taskIds = await provisionTasks(
      tenant,
      plan,
      project.name,
      projectInfo.id,
      taskType.id,
      taskStartStatus?.id,
      provisioned.byName,
      startDate,
      existingTasksByName,
      onProgress,
      signal,
    );
    taskCount += taskIds.length;

    // Сброс к исходному состоянию: задачи вне плана (и дубли плановых) — результат прошлой игры.
    const keep = new Set(taskIds);
    const extraTasks = existingTasks.filter(
      (t) => !keep.has(t.id) && normalizeName(t.name) !== normalizeName(project.name),
    );
    for (const extra of extraTasks) {
      assertNotAborted(signal);
      onProgress(`Удаляем задачу вне плана «${extra.name}»`);
      await deleteTask({ tenantId: tenant.id, projectId: projectInfo.id, id: extra.id });
    }

    // Ресурсы, подключённые по карточкам (не из плана и не менеджер), — отключаем от проекта
    const planResources = new Set(plan.resources.map((r) => normalizeName(r.name)));
    const links = await projectResources(tenant.id, projectInfo.id);
    for (const link of links) {
      const name = normalizeName(link.resource?.name ?? '');
      if (!name || planResources.has(name) || link.resourceId === managerResourceId) continue;
      onProgress(`Отключаем от проекта ресурс вне плана «${link.resource?.name}»`);
      try {
        await deleteProjectResource({ tenantId: tenant.id, projectId: projectInfo.id, id: link.id });
      } catch (error) {
        onProgress(`Ресурс не отключён: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    let removedPaymentCount = 0;
    let basePaymentCount = 0;
    try {
      onProgress(`Команда «${project.shortName}»: удаляем платежи прошлой игры…`);
      removedPaymentCount = await clearProjectPayments(tenant.id, projectInfo.id);
      onProgress(`Команда «${project.shortName}»: базовые платежи из плана работ…`);
      // задачи перечитываем: X-Lance пересчитал даты по связям — по ним плановые даты платежей
      const scheduled = await fetchTasks(tenant.id, projectInfo.id);
      basePaymentCount = (
        await createBasePayments({ tenantId: tenant.id, teamId, projectId: projectInfo.id, tasks: scheduled })
      ).length;
    } catch (error) {
      onProgress(`Платежи не подготовлены: ${error instanceof Error ? error.message : String(error)}`);
    }

    teams.push({
      teamId,
      projectId: projectInfo.id,
      code,
      name: project.name,
      taskIds,
      resourceIds,
      reusedProject,
      removedTaskCount: extraTasks.length,
      removedPaymentCount,
      basePaymentCount,
    });
  }

  const result: ProvisionResult = {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantKey: tenant.key,
    createdTenant,
    managerResourceId,
    teams,
    taskCount,
    resourceCount,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  saveProvisionResult(result);
  onProgress('Готово.');
  return result;
}
