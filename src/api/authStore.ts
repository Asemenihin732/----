/**
 * authStore.ts — авторизация X-Lance через GraphQL.
 *
 * • `signIn` / `signUp` → Tokens { access_token, refresh_token }.
 * • Токены живут в localStorage (ключ `xlance-auth-v1`).
 * • `authGql` — обёртка над rawGql: подставляет access-токен и при ошибке
 *   UNAUTHENTICATED один раз обновляет его через `refreshToken`.
 */
import { rawGql, GraphqlError } from './graphql';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AccountRole {
  id: string;
  name: string;
}

export interface Account {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  avatarUrl?: string | null;
  roleIds: string[];
  roles: AccountRole[];
}

export interface SignUpPayload {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

const AUTH_KEY = 'xlance-auth-v1';

/* --------------------------------- хранение -------------------------------- */

function loadTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthTokens>;
    if (parsed?.accessToken && parsed?.refreshToken) {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
  } catch {
    /* ignore */
  }
  return null;
}

let tokens: AuthTokens | null = loadTokens();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    if (tokens) localStorage.setItem(AUTH_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export const authStore = {
  /** Подписка на смену токенов (для React-контекста). */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getTokens(): AuthTokens | null {
    return tokens;
  },
  get accessToken(): string | null {
    return tokens?.accessToken ?? null;
  },
  get refreshToken(): string | null {
    return tokens?.refreshToken ?? null;
  },
  isAuthenticated(): boolean {
    return Boolean(tokens?.accessToken);
  },
  setTokens(next: AuthTokens): void {
    tokens = next;
    persist();
    emit();
  },
  clear(): void {
    tokens = null;
    persist();
    emit();
  },
};

/* --------------------------------- мутации --------------------------------- */

const SIGN_IN = /* GraphQL */ `
  mutation SignIn($input: SignInInput!) {
    signIn(input: $input) {
      access_token
      refresh_token
    }
  }
`;

const SIGN_UP = /* GraphQL */ `
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      access_token
      refresh_token
    }
  }
`;

const REFRESH_TOKEN = /* GraphQL */ `
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) {
      access_token
      refresh_token
    }
  }
`;

const ME = /* GraphQL */ `
  query Me {
    me {
      id
      email
      firstName
      lastName
      emailVerified
      avatarUrl
      roleIds
      roles {
        id
        name
      }
    }
  }
`;

interface TokensPayload {
  access_token: string;
  refresh_token: string;
}

function toTokens(payload: TokensPayload): AuthTokens {
  return { accessToken: payload.access_token, refreshToken: payload.refresh_token };
}

/** Вход по email и паролю. Сохраняет токены. */
export async function requestSignIn(email: string, password: string): Promise<AuthTokens> {
  const data = await rawGql<{ signIn: TokensPayload }>(SIGN_IN, { input: { email, password } });
  const next = toTokens(data.signIn);
  authStore.setTokens(next);
  return next;
}

/** Регистрация. Сохраняет токены. */
export async function requestSignUp(payload: SignUpPayload): Promise<AuthTokens> {
  const data = await rawGql<{ signUp: TokensPayload }>(SIGN_UP, { input: payload });
  const next = toTokens(data.signUp);
  authStore.setTokens(next);
  return next;
}

/** Текущий пользователь по сохранённому токену. */
export async function fetchMe(): Promise<Account> {
  const data = await rawGql<{ me: Account }>(ME, undefined, { token: authStore.accessToken });
  return data.me;
}

/** Выход: забываем токены. */
export function signOut(): void {
  authStore.clear();
}

/* --------------------------------- refresh --------------------------------- */

let refreshInFlight: Promise<AuthTokens> | null = null;

/** Обновить access-токен. Параллельные вызовы переиспользуют один запрос. */
export function refreshTokens(): Promise<AuthTokens> {
  if (!refreshInFlight) {
    const current = authStore.getTokens();
    if (!current) {
      return Promise.reject(new Error('Нет refresh-токена — требуется повторный вход'));
    }
    refreshInFlight = rawGql<{ refreshToken: TokensPayload }>(REFRESH_TOKEN, {
      input: { refresh_token: current.refreshToken },
    })
      .then((data) => {
        const next = toTokens(data.refreshToken);
        authStore.setTokens(next);
        return next;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function isAuthError(error: GraphqlError): boolean {
  if (error.code === 'UNAUTHENTICATED') return true;
  if (error.status === 401) return true;
  return /unauth|jwt|токен|token/i.test(error.message) && error.status >= 400;
}

/**
 * Авторизованный GraphQL-запрос: подставляет access-токен и при истечении
 * один раз обновляет его через refreshToken, затем повторяет запрос.
 */
export async function authGql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const attempt = () => rawGql<T>(query, variables, { token: authStore.accessToken });
  try {
    return await attempt();
  } catch (error) {
    if (error instanceof GraphqlError && isAuthError(error) && authStore.refreshToken) {
      try {
        await refreshTokens();
      } catch {
        authStore.clear();
        throw error;
      }
      return attempt();
    }
    throw error;
  }
}
