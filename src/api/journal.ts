/**
 * journal.ts — журнал действий игры в X-Lance.
 *
 * Единая точка записи о том, что приложение отправило в X-Lance и что
 * получило в ответ. Записи пишутся в консоль браузера и возвращаются
 * вызывающему коду — удобно для отладки на живом стенде.
 */
import type { XlSyncLogEntry } from './types';

let counter = 0;

const newId = (): string => `log-${Date.now().toString(36)}-${++counter}`;

/** Зафиксировать действие в журнале X-Lance. */
export function journalLog(
  projectId: string,
  module: string,
  action: string,
  ok = true,
  payload?: Record<string, unknown>,
  error?: string,
): XlSyncLogEntry {
  const entry: XlSyncLogEntry = {
    id: newId(),
    at: new Date().toISOString(),
    projectId,
    module,
    action,
    payload,
    ok,
    error,
  };

  const title = `[X-Lance] ${module} · ${projectId || '—'} · ${action}`;
  if (ok) console.info(title, payload ?? '');
  else console.warn(`${title} — ошибка: ${error ?? 'неизвестно'}`, payload ?? '');

  return entry;
}
