/**
 * POST /api/join — вход участника в тенант игры по ссылке.
 *
 * Гость не авторизован и сам себя пригласить не может (`inviteHumanResource`
 * требует прав админа тенанта), поэтому сервер приглашает от имени фасилитатора,
 * открывшего вход в админке: его сессия хранится вместе с тенантом
 * (server/joinTenants.ts) и обновляется через refreshToken.
 *
 * Шаги: тенант из списка открытых → сессия фасилитатора → права админа →
 * человек-ресурс с этой почтой (нет — создаём) → в каждый проект тенанта с
 * проектной ролью (по умолчанию «Наблюдатель»: видит проекты и работы, ничего не
 * меняет) → аккаунт X-Lance с паролем JOIN_PASSWORD, если его ещё нет → приглашение
 * с ролью. Проекты добавляем и тем, у кого доступ уже был, — вдруг появились новые.
 *
 * Окружение:
 *   XL_JOIN_ROLE    — код роли тенанта для участника (по умолчанию TENANT_MEMBER);
 *   XL_JOIN_PROJECT_ROLE — код или название проектной роли во всех проектах тенанта
 *                    (по умолчанию PROJECT_VIEWER; none — в проекты не добавлять);
 *   XL_JOIN_STORE   — файл списка открытых тенантов (по умолчанию .data/join-tenants.json);
 *   XL_JOIN_INVITE_TIME — сколько живёт ссылка после открытия (по умолчанию 24h, 0 — без срока);
 *   VITE_XLANCE_API_URL — тот же GraphQL-эндпоинт, что у игры.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { authGql, authStore } from '../src/api/authStore';
import { GraphqlError, rawGql } from '../src/api/graphql';
import { createProjectResource, myAccess, myTenants, projects, type Tenant } from '../src/api/graphqlApi';
import { activeJoinTenants, loadJoinTenants, updateJoinTenantSession, type JoinTenant } from './joinTenants';

export interface JoinRequest {
  tenant: string;
  email: string;
  /** «Имя Фамилия» — необязательно */
  name?: string;
}

export interface JoinResponse {
  ok: boolean;
  error?: string;
  /** INVITED — приглашение отправлено, ACTIVE — доступ уже был */
  status?: string;
  /** аккаунт X-Lance создан сейчас — войти можно с этим паролем */
  password?: string;
  tenantKey?: string;
  tenantName?: string;
}

const env = () => process.env;

/** Пароль нового аккаунта участника — чтобы он сразу мог войти */
export const JOIN_PASSWORD = '12345678';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Общий ответ, чтобы по нему нельзя было перебирать чужие тенанты */
const TENANT_CLOSED = 'Тенант не найден или вход в него по ссылке закрыт.';

/* ------------------------------ лимит запросов ----------------------------- */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

/* ---------------------------------- GraphQL -------------------------------- */

const HUMANS = /* GraphQL */ `
  query JoinHumans($input: FindManyResourcesInput!) {
    resources(input: $input) {
      id
      ... on HumanResource {
        invitedEmail
        accessStatus
        account {
          email
        }
      }
    }
  }
`;

const TENANT_ROLES = /* GraphQL */ `
  query JoinRoles($input: FindManyRolesInput!) {
    tenantRoles(input: $input) {
      id
      code
      name
    }
  }
`;

const CREATE_HUMAN = /* GraphQL */ `
  mutation JoinCreateHuman($input: CreateResourceInput!) {
    createResource(input: $input) {
      id
    }
  }
`;

const INVITE = /* GraphQL */ `
  mutation JoinInvite($input: InviteHumanResourceInput!) {
    inviteHumanResource(input: $input) {
      id
      ... on HumanResource {
        accessStatus
      }
    }
  }
`;

const SIGN_UP = /* GraphQL */ `
  mutation JoinSignUp($input: SignUpInput!) {
    signUp(input: $input) {
      access_token
    }
  }
`;

const CREATE_ACCOUNT = /* GraphQL */ `
  mutation JoinCreateAccount($input: CreateAccountInput!) {
    createAccount(input: $input) {
      id
    }
  }
`;

const PROJECT_ROLES = /* GraphQL */ `
  query JoinProjectRoles($input: FindManyProjectRolesInput!) {
    projectRoles(input: $input) {
      id
      code
      name
    }
  }
`;

const PROJECT_LINKS = /* GraphQL */ `
  query JoinProjectLinks($input: FindManyProjectResourcesInput!) {
    projectResources(input: $input) {
      id
      resourceId
      enabled
      roleIds
    }
  }
`;

const UPDATE_PROJECT_LINK = /* GraphQL */ `
  mutation JoinUpdateProjectLink($input: UpdateProjectResourceInput!) {
    updateProjectResource(input: $input) {
      id
    }
  }
`;

interface ProjectLink {
  id: string;
  resourceId: string;
  enabled?: boolean;
  roleIds?: string[] | null;
}

interface Human {
  id: string;
  invitedEmail?: string | null;
  accessStatus?: string;
  account?: { email: string } | null;
}

/** Сессия фасилитатора закончилась — нужно продлить ссылку в админке */
class SessionExpired extends Error {}

/**
 * Выполнить fn от имени фасилитатора, открывшего вход. authGql работает с общим
 * authStore, поэтому запросы идут по очереди; обновлённые токены сохраняем.
 */
let queue: Promise<unknown> = Promise.resolve();

function asOpener<T>(entry: JoinTenant, fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const session = entry.session;
    if (!session) throw new SessionExpired(`нет сессии фасилитатора для ${entry.key}`);
    authStore.setTokens(session);
    try {
      return await fn();
    } catch (e) {
      // authGql очищает токены, если refreshToken не сработал
      if (!authStore.isAuthenticated()) throw new SessionExpired(`сессия ${entry.addedBy} истекла (${entry.key})`);
      throw e;
    } finally {
      const now = authStore.getTokens();
      if (now && now.refreshToken !== session.refreshToken) {
        entry.session = now;
        await updateJoinTenantSession(entry.id, now);
      }
      authStore.clear();
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

/** Открытый вход по ключу (без учёта регистра) или id */
async function findAllowedEntry(input: string): Promise<JoinTenant | null> {
  const wanted = input.trim().toLowerCase();
  return (await activeJoinTenants()).find((t) => t.id.toLowerCase() === wanted || t.key.toLowerCase() === wanted) ?? null;
}

/**
 * Может ли фасилитатор, открывший вход, приглашать в тенант — для админки:
 * ok — админ; not-admin — потерял права; no-account — сессия истекла, нужно продлить ссылку.
 */
export type ServiceStatus = 'ok' | 'not-admin' | 'no-account' | 'error';

export async function serviceStatus(entry: JoinTenant): Promise<ServiceStatus> {
  try {
    return await asOpener(entry, async () => ((await myAccess(entry.id)).isAdmin ? 'ok' : 'not-admin'));
  } catch (e) {
    if (e instanceof SessionExpired) return 'no-account';
    console.error('[join] проверка сессии фасилитатора:', e instanceof Error ? e.message : e);
    return 'error';
  }
}

/**
 * Завести аккаунт X-Lance с паролем JOIN_PASSWORD: сначала signUp от гостя, не вышло —
 * createAccount от имени фасилитатора (сработает, если у него есть права платформы).
 * false — не получилось (например, аккаунт с этой почтой уже есть); причины — в лог.
 */
async function signUp(email: string, firstName: string, lastName: string): Promise<boolean> {
  const input = { email, firstName, lastName: lastName || firstName, password: JOIN_PASSWORD };
  const why = (e: unknown) => (e instanceof GraphqlError ? `${e.code ?? e.status}: ${e.message}` : String(e));
  try {
    await rawGql(SIGN_UP, { input });
    console.info(`[join] ${email}: аккаунт создан через signUp, пароль задан`);
    return true;
  } catch (signUpError) {
    try {
      await authGql(CREATE_ACCOUNT, { input });
      console.info(`[join] ${email}: аккаунт создан через createAccount, пароль задан`);
      return true;
    } catch (createError) {
      console.warn(`[join] ${email}: пароль не задан — signUp (${why(signUpError)}), createAccount (${why(createError)})`);
      return false;
    }
  }
}

async function roleIds(tenantId: string): Promise<string[]> {
  const wanted = (env().XL_JOIN_ROLE ?? 'TENANT_MEMBER').trim();
  const data = await authGql<{ tenantRoles: { id: string; code: string; name: string }[] }>(TENANT_ROLES, {
    input: { tenantId, take: 100 },
  });
  const role = data.tenantRoles.find((r) => r.code === wanted || r.name === wanted);
  if (!role) throw new Error(`Роль «${wanted}» не найдена в тенанте`);
  return [role.id];
}

/** Проектная роль участника из XL_JOIN_PROJECT_ROLE; null — в проекты не добавляем */
async function projectRoleId(tenantId: string): Promise<string | null> {
  const wanted = (env().XL_JOIN_PROJECT_ROLE || 'PROJECT_VIEWER').trim();
  if (wanted.toLowerCase() === 'none') return null;
  const data = await authGql<{ projectRoles: { id: string; code: string; name: string }[] }>(PROJECT_ROLES, {
    input: { tenantId, take: 100 },
  });
  const role = data.projectRoles.find((r) => r.code === wanted || r.name === wanted);
  if (!role) throw new Error(`Проектная роль «${wanted}» не найдена в тенанте`);
  return role.id;
}

/**
 * Добавить человека во все проекты тенанта с проектной ролью. Уже состоит в проекте —
 * дописываем роль к его ролям (не отнимая прежние) и включаем, если был выключен.
 */
export async function addToProjects(tenantId: string, resourceId: string): Promise<void> {
  const roleId = await projectRoleId(tenantId);
  if (!roleId) return;
  for (const project of await projects(tenantId)) {
    const links = await authGql<{ projectResources: ProjectLink[] }>(PROJECT_LINKS, {
      input: { tenantId, projectId: project.id, resourceId, take: 500 },
    });
    const link = links.projectResources.find((l) => l.resourceId === resourceId);
    if (!link) {
      await createProjectResource({ tenantId, projectId: project.id, resourceId, roles: [roleId] });
    } else if (!link.roleIds?.includes(roleId) || link.enabled === false) {
      await authGql(UPDATE_PROJECT_LINK, {
        input: { id: link.id, tenantId, projectId: project.id, enabled: true, roleIds: [...new Set([...(link.roleIds ?? []), roleId])] },
      });
    }
  }
}

async function findHuman(tenantId: string, email: string): Promise<Human | null> {
  const data = await authGql<{ resources: Human[] }>(HUMANS, {
    input: { tenantId, resourceType: ['HUMAN'], take: 1000 },
  });
  const same = (value?: string | null) => value?.trim().toLowerCase() === email;
  return data.resources.find((h) => same(h.invitedEmail) || same(h.account?.email)) ?? null;
}

/** Выдать доступ: найти или создать человека и пригласить его с ролью участника */
export async function join(req: JoinRequest): Promise<JoinResponse> {
  const email = req.email.trim().toLowerCase();
  if (!req.tenant?.trim()) return { ok: false, error: 'Укажите ID тенанта.' };
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, error: 'Проверьте почту.' };
  const [firstName = email.split('@')[0], ...rest] = (req.name ?? '').trim().slice(0, 120).split(/\s+/).filter(Boolean);
  const lastName = rest.join(' ');

  const entry = await findAllowedEntry(req.tenant);
  if (!entry) return { ok: false, error: TENANT_CLOSED };
  return asOpener(entry, async () => {
    const tenant = (await myTenants()).find((t) => t.id === entry.id);
    if (!tenant) throw new Error(`${entry.addedBy} больше не состоит в тенанте ${entry.key}`);
    if (!(await myAccess(tenant.id)).isAdmin) throw new Error(`${entry.addedBy} не админ в тенанте ${tenant.key}`);
    return invite(tenant, email, firstName, lastName);
  });
}

/** Шаги от имени фасилитатора: аккаунт с паролем → человек → проекты → приглашение */
async function invite(tenant: Tenant, email: string, firstName: string, lastName: string): Promise<JoinResponse> {
  let password: string | undefined;
  const done = (status: string): JoinResponse => ({
    ok: true,
    status,
    tenantKey: tenant.key,
    tenantName: tenant.name,
    password,
  });

  const tenantRoleIds = await roleIds(tenant.id);
  let human = await findHuman(tenant.id, email);
  if (!human) {
    // аккаунт — до человека: createResource с почтой сам заводит аккаунт, и пароль потом не задать
    if (await signUp(email, firstName, lastName)) password = JOIN_PASSWORD;
    const created = await authGql<{ createResource: { id: string } }>(CREATE_HUMAN, {
      input: { tenantId: tenant.id, resourceType: 'HUMAN', firstName, lastName, email, tenantRoleIds },
    });
    // аккаунт к этому моменту есть в любом случае — наш или заведённый X-Lance
    human = { id: created.createResource.id, account: { email } };
  }
  // до приглашения: если проекты не добавились, повторный вход не пришлёт лишнее письмо
  await addToProjects(tenant.id, human.id);
  if (human.accessStatus === 'ACTIVE') return done('ACTIVE');
  // человек был и раньше, но без аккаунта — пробуем завести (приглашение привяжется к нему)
  if (!human.account && (await signUp(email, firstName, lastName))) password = JOIN_PASSWORD;
  else if (!password) console.info(`[join] ${email}: аккаунт X-Lance уже есть — пароль не трогаем`);
  const invited = await authGql<{ inviteHumanResource: { id: string; accessStatus?: string } }>(INVITE, {
    input: { id: human.id, tenantId: tenant.id, email, tenantRoleIds },
  });
  return done(invited.inviteHumanResource.accessStatus ?? 'INVITED');
}

/* ---------------------------------- HTTP ----------------------------------- */

function send(res: ServerResponse, status: number, body: JoinResponse): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Partial<JoinRequest>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error('слишком большой запрос');
  }
  return JSON.parse(raw || '{}') as Partial<JoinRequest>;
}

/** Обработчик для connect/node:http (подключён в vite.config.ts для dev и preview) */
export async function handleJoinRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Только POST.' });
  if ((await loadJoinTenants()).length === 0) {
    return send(res, 503, { ok: false, error: 'Вход по ссылке не настроен.' });
  }
  if (rateLimited(req.socket.remoteAddress ?? 'unknown')) {
    return send(res, 429, { ok: false, error: 'Слишком много попыток — подождите несколько минут.' });
  }
  let body: Partial<JoinRequest>;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { ok: false, error: 'Некорректный запрос.' });
  }
  try {
    const result = await join({
      tenant: String(body.tenant ?? ''),
      email: String(body.email ?? ''),
      name: body.name ? String(body.name) : undefined,
    });
    send(res, result.ok ? 200 : 400, result);
  } catch (e) {
    console.error('[join]', e instanceof Error ? e.message : e);
    if (e instanceof SessionExpired) {
      return send(res, 503, { ok: false, error: 'Ссылка устарела — попросите фасилитатора продлить её в админке.' });
    }
    send(res, 502, { ok: false, error: 'Не удалось выдать доступ. Попробуйте позже или обратитесь к фасилитатору.' });
  }
}
