/**
 * Конфигурация API-слоя X-Lance.
 * URL, токен и workspace читаются из .env (переменные VITE_*).
 */
import { deckCards } from '../data/deck';

/** Карточка игры по её идентификатору */
function findCard(cardId: string) {
  return deckCards.find((c) => c.id === cardId) ?? null;
}

const env = import.meta.env;

/** Адрес API по умолчанию — тот же, что в graphql.ts. */
const DEFAULT_API_URL = 'https://preview.x-lance.ru/api/graphql';

const isTrue = (value: string | undefined) => /^(1|true|yes|on)$/i.test((value ?? '').trim());

export const apiConfig = {
  /** GraphQL-эндпоинт X-Lance */
  baseUrl: env.VITE_XLANCE_API_URL ?? '',
  /** Bearer-токен (опционально: авторизация выполняется в UI) */
  token: env.VITE_XLANCE_API_TOKEN ?? '',
  /** ID рабочего пространства */
  workspaceId: env.VITE_XLANCE_WORKSPACE_ID ?? '',
  /** Заголовок приложения */
  appTitle: env.VITE_APP_TITLE ?? 'X-Lance · Спаси конференцию!',
  /** Режим отладки (VITE_DEBUG=true): показывать отчёт об отправке решений в X-Lance */
  debug: isTrue(env.VITE_DEBUG),
} as const;

/**
 * Интерфейс X-Lance на том же сервере, что и API: из
 * https://dev.x-lance.ru/api/graphql и ключа тенанта — https://dev.x-lance.ru/<ключ>.
 */
export function xlanceAppUrl(tenantKey: string): string {
  const origin = new URL(apiConfig.baseUrl || DEFAULT_API_URL).origin;
  const key = tenantKey.trim().toLowerCase();
  return key ? `${origin}/${encodeURIComponent(key)}` : origin;
}

/** Проблемы конфигурации для показа в UI */
export function configWarnings(): string[] {
  const warnings: string[] = [];
  if (!apiConfig.baseUrl) warnings.push('VITE_XLANCE_API_URL не задан — запросы к API упадут.');
  return warnings;
}

/** Модули системы X-Lance */
export type XlModule =
  | 'projects'
  | 'baseline-plans'
  | 'gantt'
  | 'resources'
  | 'competence-matrix'
  | 'change-requests'
  | 'approvals'
  | 'finance'
  | 'payment-calendar'
  | 'tasks'
  | 'knowledge-base'
  | 'contracts'
  | 'custom-metrics'
  | 'reports';

const MODULE_BY_ACTION: { pattern: RegExp; module: XlModule }[] = [
  { pattern: /ресурсный план|матрица компетенций|ставк|сопровожда|персонал|календарь|трудозатрат|дефицит/i, module: 'resources' },
  { pattern: /диаграмма ганта|критический путь|зависимост|перепланиров|пересчитать монтаж|сократить длительность|пропущенная задача/i, module: 'gantt' },
  { pattern: /запрос на изменение|обоснование роста|новый объём|пересмотр объёма|пересмотр базового/i, module: 'change-requests' },
  { pattern: /финанс|внеплан|внепланов|расход|доход|оплат|штраф|корректировка тиража|мультивалют|детализация сметы|аварийн/i, module: 'finance' },
  { pattern: /платёжный календарь/i, module: 'payment-calendar' },
  { pattern: /таск-трекинг|задач/i, module: 'tasks' },
  { pattern: /база знаний|регламент|чек-лист|исходник/i, module: 'knowledge-base' },
  { pattern: /реестр договоров|договор|претензия|брендировани|скрытые обязательства/i, module: 'contracts' },
  { pattern: /показател|отчёт о статусе|отчёты о статусе|обратная связь/i, module: 'custom-metrics' },
  { pattern: /отчёт по отклонениям|статус/i, module: 'reports' },
];

/** Определяет модуль X-Lance по идентификатору карточки или тексту действия */
export function moduleForAction(cardIdOrText: string): XlModule {
  const card = findCard(cardIdOrText);
  const text = card
    ? [
        card.title,
        ...card.variants.flatMap((v) => [v.xlanceAction, ...(v.xlanceSteps ?? [])]),
      ].join(' ')
    : cardIdOrText;
  for (const { pattern, module } of MODULE_BY_ACTION) {
    if (pattern.test(text)) return module;
  }
  return 'tasks';
}

export const MODULE_LABELS: Record<XlModule, string> = {
  projects: 'Проекты',
  'baseline-plans': 'Базовые планы и бюджеты',
  gantt: 'Диаграмма Ганта',
  resources: 'Ресурсный план',
  'competence-matrix': 'Матрица компетенций',
  'change-requests': 'Запросы на изменения',
  approvals: 'Согласование изменений',
  finance: 'Финансы',
  'payment-calendar': 'Платёжный календарь',
  tasks: 'Таск-трекинг',
  'knowledge-base': 'База знаний',
  contracts: 'Реестр договоров',
  'custom-metrics': 'Пользовательские показатели',
  reports: 'Отчёты о статусе и BI',
};
