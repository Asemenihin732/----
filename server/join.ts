/**
 * POST /api/join — вход участника в тенант игры по ссылке.
 *
 * Гость не авторизован и сам себя пригласить не может (`inviteHumanResource`
 * требует прав админа тенанта), поэтому приглашает сервер от служебного
 * аккаунта. Его пароль живёт только в окружении сервера (не VITE_* — в бандл
 * не попадает).
 *
 * Шаги: служебный вход → тенант из списка открытых (его ведёт фасилитатор в
 * админке, server/joinTenants.ts) → права админа → человек-ресурс с этой почтой
 * (нет — создаём) → приглашение с ролью.
 *
 * Окружение:
 *   XL_JOIN_EMAIL, XL_JOIN_PASSWORD — служебный аккаунт, админ игровых тенантов;
 *   XL_JOIN_ROLE    — код роли тенанта для участника (по умолчанию TENANT_MEMBER);
 *   XL_JOIN_STORE   — файл списка открытых тенантов (по умолчанию .data/join-tenants.json);
 *   XL_JOIN_INVITE_TIME — сколько живёт ссылка после открытия (по умолчанию 24h, 0 — без срока);
 *   VITE_XLANCE_API_URL — тот же GraphQL-эндпоинт, что у игры.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { authGql, authStore, requestSignIn } from '../src/api/authStore';
import { GraphqlError } from '../src/api/graphql';
import { myAccess, myTenants, type Tenant } from '../src/api/graphqlApi';
import { activeJoinTenants, loadJoinTenants } from './joinTenants';

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
  tenantKey?: string;
  tenantName?: string;
}

const env = () => process.env;

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

interface Human {
  id: string;
  invitedEmail?: string | null;
  accessStatus?: string;
  account?: { email: string } | null;
}

const serviceConfigured = () => Boolean(env().XL_JOIN_EMAIL && env().XL_JOIN_PASSWORD);

/** Служебная сессия: входим один раз, дальше authGql сам обновляет токен */
async function ensureSession(): Promise<void> {
  if (authStore.isAuthenticated()) return;
  const { XL_JOIN_EMAIL, XL_JOIN_PASSWORD } = env();
  if (!XL_JOIN_EMAIL || !XL_JOIN_PASSWORD) throw new Error('XL_JOIN_EMAIL / XL_JOIN_PASSWORD не заданы');
  await requestSignIn(XL_JOIN_EMAIL, XL_JOIN_PASSWORD);
}

/** Тенант из списка открытых — по ключу (без учёта регистра) или id; данные — глазами служебного аккаунта */
async function findAllowedTenant(input: string): Promise<Tenant | null> {
  const wanted = input.trim().toLowerCase();
  const entry = (await activeJoinTenants()).find((t) => t.id.toLowerCase() === wanted || t.key.toLowerCase() === wanted);
  if (!entry) return null;
  return (await myTenants()).find((t) => t.id === entry.id) ?? null;
}

/**
 * Готов ли служебный аккаунт приглашать в тенант — для админки:
 * ok — админ; not-admin — нет прав или не состоит в тенанте; no-account — XL_JOIN_* не заданы.
 */
export type ServiceStatus = 'ok' | 'not-admin' | 'no-account' | 'error';

export async function serviceStatus(tenantIds: string[]): Promise<Record<string, ServiceStatus>> {
  const result: Record<string, ServiceStatus> = {};
  if (!serviceConfigured()) {
    for (const id of tenantIds) result[id] = 'no-account';
    return result;
  }
  try {
    await ensureSession();
    const visible = new Set((await myTenants()).map((t) => t.id));
    for (const id of tenantIds) {
      result[id] = visible.has(id) && (await myAccess(id)).isAdmin ? 'ok' : 'not-admin';
    }
  } catch (e) {
    if (e instanceof GraphqlError && e.code === 'UNAUTHENTICATED') authStore.clear();
    console.error('[join] проверка служебного аккаунта:', e instanceof Error ? e.message : e);
    for (const id of tenantIds) result[id] ??= 'error';
  }
  return result;
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

  await ensureSession();
  const tenant = await findAllowedTenant(req.tenant);
  if (!tenant) return { ok: false, error: TENANT_CLOSED };

  const access = await myAccess(tenant.id);
  if (!access.isAdmin) throw new Error(`служебный аккаунт не админ в тенанте ${tenant.key}`);

  const done = (status: string): JoinResponse => ({
    ok: true,
    status,
    tenantKey: tenant.key,
    tenantName: tenant.name,
  });

  const tenantRoleIds = await roleIds(tenant.id);
  let human = await findHuman(tenant.id, email);
  if (human?.accessStatus === 'ACTIVE') return done('ACTIVE');
  if (!human) {
    const created = await authGql<{ createResource: { id: string } }>(CREATE_HUMAN, {
      input: { tenantId: tenant.id, resourceType: 'HUMAN', firstName, lastName, email, tenantRoleIds },
    });
    human = { id: created.createResource.id };
  }
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
  if (!serviceConfigured() || (await loadJoinTenants()).length === 0) {
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
    // служебная сессия могла протухнуть — следующий запрос войдёт заново
    if (e instanceof GraphqlError && e.code === 'UNAUTHENTICATED') authStore.clear();
    console.error('[join]', e instanceof Error ? e.message : e);
    send(res, 502, { ok: false, error: 'Не удалось выдать доступ. Попробуйте позже или обратитесь к фасилитатору.' });
  }
}
