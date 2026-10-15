/**
 * graphqlApi.ts — типизированные операции X-Lance GraphQL, нужные игре:
 * тенанты, справочники (типы/статусы объектов), проекты-команды, задачи и ресурсы.
 *
 * Все запросы идут через authGql — с access-токеном и автообновлением.
 */
import { authGql } from './authStore';

/* ---------------------------------- типы ----------------------------------- */

export interface Tenant {
  id: string;
  key: string;
  name: string;
  ownerId: string;
  currency: string;
  isActive: boolean;
}

export interface MyAccess {
  tenantId: string;
  accountId: string;
  resourceId?: string | null;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  canViewProjects: boolean;
  permissions: string[];
}

export interface ObjectTypeInfo {
  id: string;
  name: string;
  objectClass: string;
  enabled: boolean;
  isScheduled: boolean;
  startStatusId: string;
}

export type StatusCategory = 'START' | 'IN_PROGRESS' | 'CLOSING';

export interface ObjectStatusInfo {
  id: string;
  name: string;
  category: StatusCategory;
  objectTypeIds: string[];
  projectId?: string | null;
  position: number;
}

export interface ResourceInfo {
  id: string;
  name: string;
  resourceType: string;
  accountId?: string | null;
}

export interface ProjectInfo {
  id: string;
  code: string;
  name: string;
  objectTypeId: string;
  statusId?: string | null;
  managerId?: string | null;
  startDate: string;
  endDate?: string | null;
}

/** Тип связи между задачами: финиш→старт и т. д. */
export type TaskDependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface PredecessorInfo {
  predecessorId: string;
  type: TaskDependencyType;
  lag?: number | null;
}

export interface TaskInfo {
  id: string;
  code: string;
  name: string;
  projectId: string;
  objectTypeId: string;
  statusId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** Длительность задачи, дн. */
  duration?: number | null;
  parentId?: string | null;
  isSummary?: boolean;
  isMilestone?: boolean;
  childrenIds?: string[];
  assignments?: AssignmentInfo[] | null;
  predecessors?: PredecessorInfo[];
  contentVersion?: number;
  scheduleVersion?: number;
}

/** Назначение ресурса на задачу (как отдаёт X-Lance). */
export interface AssignmentInfo {
  id?: string;
  resourceId: string;
  planWork?: number | null;
  units?: number | null;
}

export interface AssignmentInput {
  resourceId: string;
  units?: number;
  planWork?: number;
}

export interface PredecessorInput {
  predecessorId: string;
  type: TaskDependencyType;
  lag?: number;
}

export interface CostRateInfo {
  id: string;
  resourceId: string;
  amount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isCurrent: boolean;
}

/* -------------------------------- тенанты ---------------------------------- */

const MY_TENANTS = /* GraphQL */ `
  query MyTenants {
    myTenants {
      id
      key
      name
      ownerId
      currency
      isActive
    }
  }
`;

const CREATE_TENANT = /* GraphQL */ `
  mutation CreateTenant($input: CreateTenantInput!) {
    createTenant(input: $input) {
      id
      key
      name
      ownerId
      currency
      isActive
    }
  }
`;

const MY_ACCESS = /* GraphQL */ `
  query MyAccess($input: MyAccessInput!) {
    myAccess(input: $input) {
      tenantId
      accountId
      resourceId
      isAdmin
      isPlatformAdmin
      canViewProjects
      permissions
    }
  }
`;

export async function myTenants(): Promise<Tenant[]> {
  const data = await authGql<{ myTenants: Tenant[] }>(MY_TENANTS);
  return data.myTenants;
}

export async function createTenant(name: string, key?: string): Promise<Tenant> {
  const data = await authGql<{ createTenant: Tenant }>(CREATE_TENANT, { input: { name, key } });
  return data.createTenant;
}

export async function myAccess(tenantId: string): Promise<MyAccess> {
  const data = await authGql<{ myAccess: MyAccess }>(MY_ACCESS, { input: { tenantId } });
  return data.myAccess;
}

/**
 * Найти тенант по имени/ключу или создать новый.
 * Позволяет повторно запускать игру на уже развёрнутом пространстве.
 */
export async function ensureTenant(name: string, key?: string): Promise<{ tenant: Tenant; created: boolean }> {
  const list = await myTenants();
  const wanted = name.trim().toLowerCase();
  const existing =
    list.find((t) => t.name.trim().toLowerCase() === wanted) ??
    (key ? list.find((t) => t.key.toLowerCase() === key.toLowerCase()) : undefined);
  if (existing) return { tenant: existing, created: false };
  const tenant = await createTenant(name, key);
  return { tenant, created: true };
}

/* ------------------------------- справочники -------------------------------- */

const OBJECT_TYPES = /* GraphQL */ `
  query ObjectTypes($input: FindManyObjectTypesInput!) {
    objectTypes(input: $input) {
      id
      name
      objectClass
      enabled
      isScheduled
      startStatusId
    }
  }
`;

const OBJECT_STATUSES = /* GraphQL */ `
  query ObjectStatuses($input: FindManyObjectStatusesInput!) {
    objectStatuses(input: $input) {
      id
      name
      category
      objectTypeIds
      projectId
      position
    }
  }
`;

export async function objectTypes(tenantId: string): Promise<ObjectTypeInfo[]> {
  const data = await authGql<{ objectTypes: ObjectTypeInfo[] }>(OBJECT_TYPES, {
    input: { tenantId, take: 100 },
  });
  return data.objectTypes;
}

export async function objectStatuses(tenantId: string): Promise<ObjectStatusInfo[]> {
  const data = await authGql<{ objectStatuses: ObjectStatusInfo[] }>(OBJECT_STATUSES, {
    input: { tenantId, take: 200 },
  });
  return data.objectStatuses;
}

/** Выбрать тип объекта по классу; при прочих равных предпочитаем планируемый. */
export function pickObjectType(
  types: ObjectTypeInfo[],
  objectClass: string,
  preferScheduled = false,
): ObjectTypeInfo | undefined {
  const candidates = types.filter((t) => t.objectClass.toUpperCase() === objectClass.toUpperCase() && t.enabled);
  if (candidates.length === 0) return undefined;
  if (preferScheduled) {
    const scheduled = candidates.find((t) => t.isScheduled);
    if (scheduled) return scheduled;
  }
  return candidates[0];
}

/** Стартовый статус для типа объекта. */
export function pickStartStatus(
  statuses: ObjectStatusInfo[],
  objectTypeId: string,
): ObjectStatusInfo | undefined {
  return statuses.find(
    (s) => s.category === 'START' && s.objectTypeIds.includes(objectTypeId),
  );
}

/* -------------------------------- ресурсы ---------------------------------- */

const RESOURCES = /* GraphQL */ `
  query Resources($input: FindManyResourcesInput!) {
    resources(input: $input) {
      id
      name
      resourceType
      ... on HumanResource {
        accountId
      }
    }
  }
`;

const CREATE_RESOURCE = /* GraphQL */ `
  mutation CreateResource($input: CreateResourceInput!) {
    createResource(input: $input) {
      id
      name
      resourceType
      ... on HumanResource {
        accountId
      }
    }
  }
`;

const CREATE_PROJECT_RESOURCE = /* GraphQL */ `
  mutation CreateProjectResource($input: CreateProjectResourceInput!) {
    createProjectResource(input: $input) {
      id
      projectId
      resourceId
    }
  }
`;

const PROJECT_RESOURCES = /* GraphQL */ `
  query ProjectResources($input: FindManyProjectResourcesInput!) {
    projectResources(input: $input) {
      id
      projectId
      resourceId
      resourceType
      resource {
        id
        name
      }
    }
  }
`;

export interface ProjectResourceInfo {
  id: string;
  projectId: string;
  resourceId: string;
  resourceType: string;
  resource?: { id: string; name: string } | null;
}

export async function resources(tenantId: string): Promise<ResourceInfo[]> {
  const data = await authGql<{ resources: ResourceInfo[] }>(RESOURCES, {
    input: { tenantId, take: 200 },
  });
  return data.resources;
}

export async function createResource(input: {
  tenantId: string;
  resourceType: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): Promise<ResourceInfo> {
  const data = await authGql<{ createResource: ResourceInfo }>(CREATE_RESOURCE, { input });
  return data.createResource;
}

export async function createProjectResource(input: {
  tenantId: string;
  projectId: string;
  resourceId: string;
  roles?: string[];
}): Promise<{ id: string; projectId: string; resourceId: string }> {
  const data = await authGql<{ createProjectResource: { id: string; projectId: string; resourceId: string } }>(
    CREATE_PROJECT_RESOURCE,
    { input },
  );
  return data.createProjectResource;
}

export async function projectResources(
  tenantId: string,
  projectId: string,
): Promise<ProjectResourceInfo[]> {
  const data = await authGql<{ projectResources: ProjectResourceInfo[] }>(PROJECT_RESOURCES, {
    input: { tenantId, projectId, take: 500 },
  });
  return data.projectResources;
}

/* ----------------------------- стоимость ресурса ---------------------------- */

const COST_RATES = /* GraphQL */ `
  query CostRates($input: FindCostRatesInput!) {
    costRates(input: $input) {
      id
      resourceId
      amount
      effectiveFrom
      effectiveTo
      isCurrent
    }
  }
`;

const CREATE_COST_RATE = /* GraphQL */ `
  mutation CreateCostRate($input: CreateCostRateInput!) {
    createCostRate(input: $input) {
      id
      resourceId
      amount
      effectiveFrom
      effectiveTo
      isCurrent
    }
  }
`;

const UPDATE_COST_RATE = /* GraphQL */ `
  mutation UpdateCostRate($input: UpdateCostRateInput!) {
    updateCostRate(input: $input) {
      id
      resourceId
      amount
      effectiveFrom
      effectiveTo
      isCurrent
    }
  }
`;

export async function costRates(tenantId: string, resourceId: string): Promise<CostRateInfo[]> {
  const data = await authGql<{ costRates: CostRateInfo[] }>(COST_RATES, {
    input: { tenantId, resourceId },
  });
  return data.costRates;
}

export async function createCostRate(input: {
  tenantId: string;
  resourceId: string;
  amount: number;
  effectiveFrom: string;
}): Promise<CostRateInfo> {
  const data = await authGql<{ createCostRate: CostRateInfo }>(CREATE_COST_RATE, { input });
  return data.createCostRate;
}

export async function updateCostRate(input: {
  tenantId: string;
  id: string;
  amount?: number;
  effectiveFrom?: string;
}): Promise<CostRateInfo> {
  const data = await authGql<{ updateCostRate: CostRateInfo }>(UPDATE_COST_RATE, { input });
  return data.updateCostRate;
}

/* -------------------------------- проекты ---------------------------------- */

const PROJECTS = /* GraphQL */ `
  query Projects($input: FindManyProjectsInput!) {
    projects(input: $input) {
      id
      code
      name
      objectTypeId
      statusId
      managerId
      startDate
      endDate
    }
  }
`;

const CREATE_PROJECT = /* GraphQL */ `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      code
      name
      objectTypeId
      statusId
      managerId
      startDate
      endDate
    }
  }
`;

export async function projects(tenantId: string): Promise<ProjectInfo[]> {
  const data = await authGql<{ projects: ProjectInfo[] }>(PROJECTS, {
    input: { tenantId, take: 200 },
  });
  return data.projects;
}

export async function createProject(input: {
  tenantId: string;
  code: string;
  name: string;
  objectTypeId: string;
  statusId?: string;
  managerId?: string;
  startDate?: string;
}): Promise<ProjectInfo> {
  const data = await authGql<{ createProject: ProjectInfo }>(CREATE_PROJECT, { input });
  return data.createProject;
}

/* --------------------------------- задачи ---------------------------------- */

/** Набор полей задачи, общий для выборок и мутаций. */
const TASK_FIELDS = /* GraphQL */ `
  id
  code
  name
  projectId
  objectTypeId
  statusId
  startDate
  endDate
  duration
  parentId
  isSummary
  isMilestone
  childrenIds
  contentVersion
  scheduleVersion
  assignments {
    id
    resourceId
    planWork
    units
  }
  predecessors {
    predecessorId
    type
    lag
  }
`;

const CREATE_TASK = /* GraphQL */ `
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

const UPDATE_TASK = /* GraphQL */ `
  mutation UpdateTask($input: UpdateTaskInput!) {
    updateTask(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

const DELETE_TASK = /* GraphQL */ `
  mutation DeleteTask($input: DeleteTaskInput!) {
    deleteTask(input: $input)
  }
`;

const TASK = /* GraphQL */ `
  query Task($input: FindOneTaskInput!) {
    task(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

const TASKS = /* GraphQL */ `
  query Tasks($input: FindManyTasksInput!) {
    tasks(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

export async function createTask(input: {
  tenantId: string;
  projectId: string;
  objectTypeId: string;
  name: string;
  statusId?: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  planWork?: number;
  assignments?: AssignmentInput[];
  parentId?: string;
  predecessors?: PredecessorInput[];
}): Promise<TaskInfo> {
  const data = await authGql<{ createTask: TaskInfo }>(CREATE_TASK, { input });
  return data.createTask;
}

export async function updateTask(input: {
  tenantId: string;
  id: string;
  projectId: string;
  contentVersion: number;
  scheduleVersion: number;
  name?: string;
  parentId?: string | null;
  predecessors?: PredecessorInput[];
  startDate?: string;
  endDate?: string;
  duration?: number;
  assignments?: AssignmentInput[];
}): Promise<TaskInfo> {
  const data = await authGql<{ updateTask: TaskInfo }>(UPDATE_TASK, { input });
  return data.updateTask;
}

export async function deleteTask(input: {
  tenantId: string;
  projectId: string;
  id: string;
}): Promise<boolean> {
  const data = await authGql<{ deleteTask: boolean }>(DELETE_TASK, { input });
  return data.deleteTask;
}

export async function task(tenantId: string, id: string): Promise<TaskInfo | null> {
  const data = await authGql<{ task: TaskInfo | null }>(TASK, { input: { tenantId, id } });
  return data.task;
}

export async function tasks(tenantId: string, projectId: string): Promise<TaskInfo[]> {
  const data = await authGql<{ tasks: TaskInfo[] }>(TASKS, {
    input: { tenantId, projectId: [projectId] },
  });
  return data.tasks;
}
