/**
 * Тенанты, куда открыт вход по ссылке (/join). Список ведёт фасилитатор в админке,
 * хранится JSON-файлом на сервере: XL_JOIN_STORE, по умолчанию .data/join-tenants.json
 * (в git не попадает).
 *
 * Ссылка живёт XL_JOIN_INVITE_TIME с момента открытия (по умолчанию 24h; число —
 * минуты, суффиксы m/h/d: 90m, 12h, 3d; 0 — без срока). Истёкший вход остаётся в
 * списке — фасилитатор может его продлить, — но участников не пускает.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface JoinTenant {
  id: string;
  key: string;
  name: string;
  /** почта фасилитатора, открывшего вход */
  addedBy: string;
  addedAt: string;
  /** до какого момента работает ссылка; null — без срока */
  expiresAt?: string | null;
}

const storePath = () => process.env.XL_JOIN_STORE || '.data/join-tenants.json';

const DEFAULT_INVITE_TIME = '24h';
const UNIT_MS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Срок жизни ссылки из XL_JOIN_INVITE_TIME, мс; null — без срока */
export function inviteTimeMs(raw = process.env.XL_JOIN_INVITE_TIME): number | null {
  const value = (raw?.trim() || DEFAULT_INVITE_TIME).toLowerCase();
  const m = /^(\d+(?:\.\d+)?)\s*([mhd]?)$/.exec(value);
  if (!m) {
    console.warn(`[join] XL_JOIN_INVITE_TIME="${raw}" не разобран — беру ${DEFAULT_INVITE_TIME}`);
    return inviteTimeMs(DEFAULT_INVITE_TIME);
  }
  const ms = Number(m[1]) * UNIT_MS[m[2] || 'm'];
  return ms > 0 ? ms : null;
}

export const isExpired = (t: JoinTenant, now = Date.now()) => Boolean(t.expiresAt && Date.parse(t.expiresAt) <= now);

export async function loadJoinTenants(): Promise<JoinTenant[]> {
  try {
    const parsed = JSON.parse(await readFile(storePath(), 'utf-8')) as { tenants?: JoinTenant[] };
    return Array.isArray(parsed.tenants) ? parsed.tenants : [];
  } catch {
    return []; // файла ещё нет — вход никуда не открыт
  }
}

/** Запись через временный файл — чтобы прерванная запись не оставила битый JSON */
async function save(tenants: JoinTenant[]): Promise<void> {
  const path = storePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify({ tenants }, null, 2), 'utf-8');
  await rename(`${path}.tmp`, path);
}

/** Тенанты, куда вход открыт сейчас (срок ссылки не истёк) */
export async function activeJoinTenants(): Promise<JoinTenant[]> {
  return (await loadJoinTenants()).filter((t) => !isExpired(t));
}

/** Открыть вход или продлить его: срок ссылки отсчитывается заново от addedAt */
export async function upsertJoinTenant(entry: Omit<JoinTenant, 'expiresAt'>): Promise<void> {
  const ttl = inviteTimeMs();
  const opened: JoinTenant = { ...entry, expiresAt: ttl ? new Date(Date.parse(entry.addedAt) + ttl).toISOString() : null };
  const tenants = await loadJoinTenants();
  const i = tenants.findIndex((t) => t.id === entry.id);
  if (i >= 0) tenants[i] = opened;
  else tenants.push(opened);
  await save(tenants);
}

export async function removeJoinTenant(id: string): Promise<void> {
  await save((await loadJoinTenants()).filter((t) => t.id !== id));
}
