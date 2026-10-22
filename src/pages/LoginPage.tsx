/**
 * Вход в X-Lance: email + пароль (GraphQL signIn), либо регистрация (signUp).
 */
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { XlanceLogo } from '../components/XLanceLogo';
import { GRAPHQL_ENDPOINT } from '../api/graphql';

interface RedirectState {
  from?: string;
}

const inputCls =
  'w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-strong outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';

export default function LoginPage() {
  const { status, error, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as RedirectState | null)?.from ?? '/';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (!isSignup || (firstName.trim() && lastName.trim()));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      if (isSignup) {
        await signUp({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
      } else {
        await signIn(email.trim(), password);
      }
      navigate(from, { replace: true });
    } catch {
      // текст ошибки уже поднят в контекст
    } finally {
      setBusy(false);
    }
  };

  const message = localError ?? error;

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[29rem] overflow-hidden rounded-3xl border border-line bg-card">
        <div className="bg-gradient-to-br from-brand-dark via-[#37516d] to-[#57799f] p-7 text-white">
          {/* белый вариант логотипа (Logo white из макета) */}
          <div className="flex flex-col gap-2 [--c-logo-ink:#ffffff]">
            <XlanceLogo size="md" className="self-start" />
            <span className="text-xs text-white/80">Деловая игра «Спаси конференцию!»</span>
          </div>
        </div>

        <form onSubmit={submit} className="p-7">
          <h2 className="mb-1 text-lg font-semibold text-strong">
            {isSignup ? 'Регистрация' : 'Вход в систему'}
          </h2>
          <p className="mb-5 text-sm text-muted">
            {isSignup
              ? 'Создайте аккаунт, чтобы развернуть игру в X-Lance.'
              : 'Войдите под своей учётной записью X-Lance.'}
          </p>

          {message ? (
            <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {message}
            </div>
          ) : null}

          <div className="space-y-4">
            {isSignup ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold text-muted">Имя</span>
                  <input
                    className={inputCls}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold text-muted">Фамилия</span>
                  <input
                    className={inputCls}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </label>
              </div>
            ) : null}

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-muted">Email</span>
              <input
                className={inputCls}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-muted">Пароль</span>
              <input
                className={inputCls}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </label>

            <button
              type="submit"
              disabled={!canSubmit || busy}
              className="w-full rounded-lg bg-brand px-6 py-3 font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Подождите…' : isSignup ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </div>

          {/* <div className="mt-5 text-center text-sm text-muted">
            {isSignup ? 'Уже есть аккаунт? ' : 'Нет аккаунта? '}
            <button
              type="button"
              className="font-semibold text-brand underline"
              onClick={() => {
                setMode(isSignup ? 'signin' : 'signup');
                setLocalError(null);
              }}
            >
              {isSignup ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </div> */}

          <p className="mt-4 text-center text-xs text-faint">
            API: {GRAPHQL_ENDPOINT}
            {status === 'loading' ? ' · проверяем сессию…' : ''}
          </p>
        </form>
      </div>
    </div>
  );
}
