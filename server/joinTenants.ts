/**
 * Тенанты, куда открыт вход по ссылке (/join). Список ведёт фасилитатор в админке,
 * хранится JSON-файлом на сервере: XL_JOIN_STORE, по умолчанию .data/join-tenants.json
 * (в git не попадает).
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
}

const storePath = () => process.env.XL_JOIN_STORE || '.data/join-tenants.json';

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

/** Добавить тенант или обновить его ключ и название */
export async function upsertJoinTenant(entry: JoinTenant): Promise<void> {
  const tenants = await loadJoinTenants();
  const i = tenants.findIndex((t) => t.id === entry.id);
  if (i >= 0) tenants[i] = { ...tenants[i], key: entry.key, name: entry.name };
  else tenants.push(entry);
  await save(tenants);
}

export async function removeJoinTenant(id: string): Promise<void> {
  await save((await loadJoinTenants()).filter((t) => t.id !== id));
}
