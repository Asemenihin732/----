/**
 * graphql.ts — низкоуровневый транспорт GraphQL для X-Lance API.
 *
 * Сервер (Apollo) включён с CSRF-защитой: запрос без `content-type: application/json`
 * (или без заголовка `apollo-require-preflight`) отклоняется. Поэтому транспорт
 * всегда шлёт оба заголовка.
 *
 * Здесь нет бизнес-логики: только POST, разбор `errors` и единый класс ошибки.
 * Токен авторизации подставляет слой выше (authStore.ts).
 */

export interface GraphQLErrorItem {
  message: string;
  path?: (string | number)[];
  extensions?: {
    code?: string;
    status?: number;
    [key: string]: unknown;
  };
}

/** Ошибка GraphQL-ответа или транспорта. */
export class GraphqlError extends Error {
  constructor(
    public errors: GraphQLErrorItem[],
    public status: number,
  ) {
    super(errors.map((e) => e.message).join('; ') || `GraphQL error (${status})`);
    this.name = 'GraphqlError';
  }

  /** Код первой ошибки (UNAUTHENTICATED, GRAPHQL_VALIDATION_FAILED, …) */
  get code(): string | undefined {
    return this.errors[0]?.extensions?.code;
  }
}

const DEFAULT_ENDPOINT = 'https://preview.x-lance.ru/api/graphql';

/** Адрес GraphQL-эндпоинта X-Lance (VITE_XLANCE_API_URL, иначе preview). */
function readEndpoint(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (env?.VITE_XLANCE_API_URL) return env.VITE_XLANCE_API_URL.trim();
  } catch {
    /* вне Vite (например, в Node) env недоступен — используем значение по умолчанию */
  }
  return DEFAULT_ENDPOINT;
}

export const GRAPHQL_ENDPOINT = readEndpoint();

export interface RawGqlOptions {
  /** Bearer-токен доступа; если не задан — запрос уйдёт анонимно. */
  token?: string | null;
  signal?: AbortSignal;
}

/** Выполнить GraphQL-запрос без автообновления токена. */
export async function rawGql<T>(
  query: string,
  variables?: Record<string, unknown>,
  options: RawGqlOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    // Обходит CSRF-проверку Apollo даже для «непростых» запросов
    'apollo-require-preflight': 'true',
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let res: Response;
  try {
    res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: options.signal,
    });
  } catch (e) {
    throw new GraphqlError(
      [{ message: `Сеть недоступна: ${(e as Error).message}`, extensions: { code: 'NETWORK' } }],
      0,
    );
  }

  let payload: { data?: T; errors?: GraphQLErrorItem[] };
  try {
    payload = (await res.json()) as { data?: T; errors?: GraphQLErrorItem[] };
  } catch {
    throw new GraphqlError(
      [{ message: `Некорректный ответ сервера (${res.status})`, extensions: { code: 'BAD_RESPONSE' } }],
      res.status,
    );
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new GraphqlError(payload.errors, res.status);
  }
  if (!res.ok) {
    throw new GraphqlError(
      [{ message: `${res.status} ${res.statusText}`, extensions: { code: 'HTTP' } }],
      res.status,
    );
  }
  return payload.data as T;
}
