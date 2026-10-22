/**
 * Вход участника в тенант игры по ссылке: ID тенанта + почта → доступ.
 * Страница открыта без входа; приглашение выдаёт сервер (POST /api/join).
 * Ссылка вида /join?tenant=IG подставляет тенант заранее.
 */
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { XlanceLogo } from '../components/XLanceLogo';
import { xlanceAppUrl } from '../api/config';

const inputCls =
  'w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-strong outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';

interface JoinResult {
  ok: boolean;
  error?: string;
  status?: string;
  tenantKey?: string;
  tenantName?: string;
  /** аккаунт создан сейчас — пароль для первого входа */
  password?: string;
}

export default function JoinPage() {
  const [params] = useSearchParams();
  const [tenant, setTenant] = useState(() => params.get('tenant') ?? '');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JoinResult | null>(null);

  const canSubmit = tenant.trim().length > 0 && email.trim().length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenant: tenant.trim(), email: email.trim(), name: name.trim() }),
      });
      const data = (await res.json().catch(() => ({ ok: false }))) as JoinResult;
      if (data.ok) setResult(data);
      else setError(data.error ?? `Не удалось выдать доступ (${res.status}).`);
    } catch {
      setError('Сервер недоступен — проверьте подключение.');
    } finally {
      setBusy(false);
    }
  };

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

        {result ? (
          <div data-testid="join-done" className="p-7">
            <h2 className="mb-1 text-lg font-semibold text-strong">
              {result.status === 'ACTIVE' ? 'Доступ уже есть' : 'Доступ выдан'}
            </h2>
            <p className="mb-5 text-sm text-muted">
              {result.status === 'ACTIVE'
                ? `У почты ${email.trim()} уже есть доступ к «${result.tenantName}».`
                : `Приглашение в «${result.tenantName}» отправлено на ${email.trim()}. Откройте письмо от X-Lance и войдите с этой почтой.`}
            </p>
            {result.password ? (
              <p data-testid="join-password" className="mb-5 rounded-lg bg-soft px-4 py-3 text-sm text-strong">
                Пароль для входа: <span className="font-mono font-semibold">{result.password}</span>
              </p>
            ) : null}
            {result.tenantKey ? (
              <a
                href={xlanceAppUrl(result.tenantKey)}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg bg-brand px-6 py-3 text-center font-bold text-white transition hover:bg-brand-hover"
              >
                Открыть X-Lance
              </a>
            ) : null}
          </div>
        ) : (
          <form onSubmit={submit} className="p-7">
            <h2 className="mb-1 text-lg font-semibold text-strong">Подключиться к игре</h2>
            <p className="mb-5 text-sm text-muted">
              Введите ID тенанта, который назвал фасилитатор, и свою почту — на неё придёт доступ.
            </p>

            {error ? (
              <div data-testid="join-error" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">ID тенанта</span>
                <input
                  className={inputCls}
                  data-testid="join-tenant"
                  value={tenant}
                  onChange={(e) => setTenant(e.target.value)}
                  required
                  autoFocus={!tenant}
                  placeholder="например, IG"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">Email</span>
                <input
                  className={inputCls}
                  data-testid="join-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus={Boolean(tenant)}
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">Имя и фамилия (необязательно)</span>
                <input
                  className={inputCls}
                  data-testid="join-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>

              <button
                type="submit"
                data-testid="join-submit"
                disabled={!canSubmit || busy}
                className="w-full rounded-lg bg-brand px-6 py-3 font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Подождите…' : 'Получить доступ'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
