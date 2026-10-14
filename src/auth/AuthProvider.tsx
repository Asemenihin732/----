/**
 * AuthProvider.tsx — React-контекст авторизации X-Lance.
 *
 * Гидратация из localStorage → проверка токена через me() → статус.
 * signIn/signUp сохраняют токены, signOut их забывает.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  authStore,
  fetchMe,
  requestSignIn,
  requestSignUp,
  type Account,
  type SignUpPayload,
} from '../api/authStore';
import { GraphqlError } from '../api/graphql';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: Account | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toMessage(error: unknown): string {
  if (error instanceof GraphqlError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Неизвестная ошибка';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    authStore.isAuthenticated() ? 'loading' : 'anonymous',
  );
  const [user, setUser] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Гидратация: если есть сохранённый токен — проверяем его через me()
  useEffect(() => {
    if (!authStore.isAuthenticated()) {
      setStatus('anonymous');
      return;
    }
    let alive = true;
    setStatus('loading');
    (async () => {
      try {
        const me = await fetchMe();
        if (!alive) return;
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (!alive) return;
        authStore.clear();
        setUser(null);
        setStatus('anonymous');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Реагируем на внешнюю очистку токенов (например, неудачный refresh)
  useEffect(
    () =>
      authStore.subscribe(() => {
        if (!authStore.isAuthenticated()) {
          setUser(null);
          setStatus('anonymous');
        }
      }),
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setStatus('loading');
    try {
      await requestSignIn(email, password);
      const me = await fetchMe();
      setUser(me);
      setStatus('authenticated');
    } catch (e) {
      setUser(null);
      setStatus('anonymous');
      setError(toMessage(e));
      throw e;
    }
  }, []);

  const signUp = useCallback(async (payload: SignUpPayload) => {
    setError(null);
    setStatus('loading');
    try {
      await requestSignUp(payload);
      const me = await fetchMe();
      setUser(me);
      setStatus('authenticated');
    } catch (e) {
      setUser(null);
      setStatus('anonymous');
      setError(toMessage(e));
      throw e;
    }
  }, []);

  const signOut = useCallback(() => {
    setError(null);
    setUser(null);
    authStore.clear();
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, signIn, signUp, signOut }),
    [status, user, error, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider');
  return ctx;
}
