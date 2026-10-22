/**
 * /api/admin/join-tenants — админка фасилитатора: куда открыт вход по ссылке.
 *
 *   GET    /                → открытые тенанты, которые видит фасилитатор, + жива ли сессия открывшего
 *   POST   / { tenantId, refreshToken } → открыть вход в тенант (или продлить срок ссылки,
 *                             XL_JOIN_INVITE_TIME); участников будут приглашать от имени того, кто открыл
 *   DELETE /:tenantId       → закрыть вход
 *
 * Фасилитатор приходит со своим access-токеном X-Lance (Authorization: Bearer).
 * Сервер проверяет его тем же X-Lance: менять список можно только по тенантам,
 * где фасилитатор — админ. Чужие тенанты в ответе не показываются.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { GraphqlError, rawGql } from '../src/api/graphql';
import { serviceStatus, type ServiceStatus } from './join';
import { loadJoinTenants, removeJoinTenant, upsertJoinTenant, type JoinTenant } from './joinTenants';

export interface AdminJoinTenant extends Omit<JoinTenant, 'session'> {
  service: ServiceStatus;
}

const CALLER_TENANTS = /* GraphQL */ `
  query AdminCaller {
    me {
      email
    }
    myTenants {
      id
      key
      name
    }
  }
`;

const CALLER_ACCESS = /* GraphQL */ `
  query AdminAccess($input: MyAccessInput!) {
    myAccess(input: $input) {
      isAdmin
    }
  }
`;

interface Caller {
  token: string;
  email: string;
  tenants: { id: string; key: string; name: string }[];
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Фасилитатор по его токену; невалидный токен — 401 (клиент обновит его и повторит) */
async function callerOf(req: IncomingMessage): Promise<Caller> {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')?.[1];
  if (!token) throw new HttpError(401, 'Нужен вход в X-Lance.');
  try {
    const data = await rawGql<{ me: { email: string }; myTenants: Caller['tenants'] }>(CALLER_TENANTS, undefined, {
      token,
    });
    return { token, email: data.me.email, tenants: data.myTenants };
  } catch (e) {
    if (e instanceof GraphqlError && (e.code === 'UNAUTHENTICATED' || e.status === 401)) {
      throw new HttpError(401, 'Сессия истекла — войдите заново.');
    }
    throw e;
  }
}

/** Менять список по тенанту может только его админ */
async function requireAdmin(caller: Caller, tenantId: string) {
  const tenant = caller.tenants.find((t) => t.id === tenantId);
  if (!tenant) throw new HttpError(403, 'Нет доступа к этому тенанту.');
  const data = await rawGql<{ myAccess: { isAdmin: boolean } }>(CALLER_ACCESS, { input: { tenantId } }, {
    token: caller.token,
  });
  if (!data.myAccess.isAdmin) throw new HttpError(403, `Открыть вход может только админ тенанта «${tenant.name}».`);
  return tenant;
}

/** Открытые тенанты, которые видит фасилитатор, с готовностью служебного аккаунта */
async function listFor(caller: Caller): Promise<AdminJoinTenant[]> {
  const visible = new Set(caller.tenants.map((t) => t.id));
  const tenants = (await loadJoinTenants()).filter((t) => visible.has(t.id));
  const result: AdminJoinTenant[] = [];
  // токены фасилитатора остаются на сервере
  for (const t of tenants) {
    const { session: _session, ...visibleFields } = t;
    result.push({ ...visibleFields, service: await serviceStatus(t) });
  }
  return result;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new HttpError(400, 'Слишком большой запрос.');
  }
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Некорректный запрос.');
  }
}

/** Обработчик для connect/node:http; req.url — путь после /api/admin/join-tenants */
export async function handleAdminJoinTenants(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const caller = await callerOf(req);
    const id = decodeURIComponent((req.url ?? '/').split('?')[0].replace(/^\/+|\/+$/g, ''));

    if (req.method === 'GET' && !id) return send(res, 200, { tenants: await listFor(caller) });

    if (req.method === 'POST' && !id) {
      const body = await readJson(req);
      const tenantId = String(body.tenantId ?? '');
      const refreshToken = String(body.refreshToken ?? '');
      if (!refreshToken) throw new HttpError(400, 'Нужен refresh-токен — войдите заново.');
      const tenant = await requireAdmin(caller, tenantId);
      await upsertJoinTenant({
        ...tenant,
        addedBy: caller.email,
        addedAt: new Date().toISOString(),
        session: { accessToken: caller.token, refreshToken },
      });
      return send(res, 200, { tenants: await listFor(caller) });
    }

    if (req.method === 'DELETE' && id) {
      await requireAdmin(caller, id);
      await removeJoinTenant(id);
      return send(res, 200, { tenants: await listFor(caller) });
    }

    return send(res, 405, { error: 'Метод не поддерживается.' });
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error('[admin]', e instanceof Error ? e.message : e);
    return send(res, 502, { error: 'X-Lance не ответил — попробуйте ещё раз.' });
  }
}
