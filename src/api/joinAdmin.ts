/**
 * Клиент админки входа по ссылке (/api/admin/join-tenants): куда открыт вход в /join.
 * Запросы идут с access-токеном X-Lance; истёк — обновляем и повторяем один раз.
 */
import { authStore, refreshTokens } from './authStore';

/** Готов ли служебный аккаунт приглашать в тенант (см. server/join.ts) */
export type ServiceStatus = 'ok' | 'not-admin' | 'no-account' | 'error';

export interface JoinTenant {
  id: string;
  key: string;
  name: string;
  addedBy: string;
  addedAt: string;
  /** до какого момента работает ссылка (XL_JOIN_INVITE_TIME на сервере); null — без срока */
  expiresAt?: string | null;
  service: ServiceStatus;
}

const BASE = '/api/admin/join-tenants';

async function request(path: string, init: RequestInit = {}): Promise<JoinTenant[]> {
  const attempt = () =>
    fetch(BASE + path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${authStore.accessToken ?? ''}`,
      },
    });
  let res = await attempt();
  if (res.status === 401 && authStore.refreshToken) {
    await refreshTokens();
    res = await attempt();
  }
  const data = (await res.json().catch(() => ({}))) as { tenants?: JoinTenant[]; error?: string };
  if (!res.ok || !data.tenants) throw new Error(data.error ?? `Сервер ответил ${res.status}`);
  return data.tenants;
}

export const joinAdmin = {
  list: () => request('/'),
  /** открыть вход; для открытого — продлить срок ссылки */
  open: (tenantId: string) => request('/', { method: 'POST', body: JSON.stringify({ tenantId }) }),
  close: (tenantId: string) => request(`/${encodeURIComponent(tenantId)}`, { method: 'DELETE' }),
};

/** Ссылка для участников: /join с подставленным тенантом */
export function joinLink(tenantKey: string): string {
  return `${window.location.origin}/join?tenant=${encodeURIComponent(tenantKey)}`;
}
