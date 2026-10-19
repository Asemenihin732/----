/**
 * Вход участника в тенант игры по ссылке: ID тенанта + почта → доступ.
 * Страница открыта без входа; приглашение выдаёт сервер (POST /api/join).
 * Ссылка вида /join?tenant=IG подставляет тенант заранее.
 */
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { xlanceAppUrl } from '../api/config';

const inputCls =
  'w-full rounded-lg border border-line bg-card px-3 py-2.5 text-sm text-strong outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';

interface JoinResult {
  ok: boolean;
  error?: string;
  status?: string;
  tenantKey?: string;
  tenantName?: string;
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
        <div className="bg-gradient-to-br from-[#212346] via-[#2a2a63] to-[#6270d0] p-7 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-lg font-black">
              X
            </span>
            <span>
              <span className="block text-lg font-extrabold leading-none">X-Lance</span>
              <span className="text-xs text-white/80">Деловая игра «Спаси конференцию!»</span>
            </span>
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
            {result.tenantKey ? (
              <a
                href={xlanceAppUrl(result.tenantKey)}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-full bg-brand px-6 py-3 text-center font-semibold text-white shadow-lg shadow-brand/30 transition hover:brightness-110"
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
                className="w-full rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
