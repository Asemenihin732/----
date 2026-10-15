/**
 * syncReports.ts — отчёты о том, что из решения по карточке заведено в X-Lance.
 *
 * Отчёт хранится по ключу «команда:раунд» в localStorage, чтобы статус и
 * кнопка «Повторить» переживали перезагрузку страницы. Подписчики узнают об
 * изменениях через событие окна.
 */
import { useEffect, useState } from 'react';

export type SyncItemKind = 'task' | 'payment' | 'change-request' | 'satisfaction' | 'manual';

export interface SyncItem {
  /** Стабильный ключ пункта: по нему повторяются только неудачные */
  key: string;
  kind: SyncItemKind;
  /** Пункт меняет деньги проекта (платёж, трудозатраты, новая работа) */
  financial: boolean;
  label: string;
  ok: boolean;
  /** Не выполнялся: ручной шаг или уже был заведён */
  skipped?: boolean;
  error?: string;
}

export interface SyncReport {
  teamId: string;
  round: number;
  cardTitle: string;
  variantKey: string;
  /** Идёт отправка */
  pending: boolean;
  at: string;
  items: SyncItem[];
}

const STORAGE_KEY = 'xlance-sync-v1';
const EVENT = 'xlance-sync-report';

const keyOf = (teamId: string, round: number) => `${teamId}:${round}`;

function loadAll(): Record<string, SyncReport> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, SyncReport>;
  } catch {
    return {};
  }
}

function saveAll(all: Record<string, SyncReport>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function loadSyncReport(teamId: string, round: number): SyncReport | null {
  return loadAll()[keyOf(teamId, round)] ?? null;
}

export function saveSyncReport(report: SyncReport) {
  const all = loadAll();
  all[keyOf(report.teamId, report.round)] = report;
  saveAll(all);
}

/** Пометить отчёт «идёт отправка» (создаётся пустым, если его ещё нет). */
export function markSyncPending(base: Omit<SyncReport, 'pending' | 'at' | 'items'>) {
  const prev = loadSyncReport(base.teamId, base.round);
  saveSyncReport({ ...base, items: prev?.items ?? [], pending: true, at: new Date().toISOString() });
}

/** Новая игра — старые отчёты больше не относятся к решениям. */
export function clearSyncReports() {
  saveAll({});
}

/** Подставить новые результаты поверх прежних (повтор неудачных пунктов). */
export function mergeSyncItems(prev: SyncItem[], next: SyncItem[]): SyncItem[] {
  const byKey = new Map(prev.map((i) => [i.key, i]));
  for (const item of next) byKey.set(item.key, item);
  return [...byKey.values()];
}

/** Отчёт по команде и раунду с подпиской на изменения. */
export function useSyncReport(teamId: string, round: number): SyncReport | null {
  const [report, setReport] = useState(() => loadSyncReport(teamId, round));
  useEffect(() => {
    const update = () => setReport(loadSyncReport(teamId, round));
    update();
    window.addEventListener(EVENT, update);
    return () => window.removeEventListener(EVENT, update);
  }, [teamId, round]);
  return report;
}
