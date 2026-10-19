/**
 * Админка фасилитатора. Пока один раздел — вход по ссылке (/join):
 * в какие тенанты участники могут войти сами, и ссылки для них.
 * Открыть или закрыть вход может только админ тенанта в X-Lance — проверяет сервер.
 */
import { useEffect, useState } from 'react';
import { myTenants, type Tenant } from '../api/graphqlApi';
import { joinAdmin, joinLink, type JoinTenant, type ServiceStatus } from '../api/joinAdmin';

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50';
const btnOutline =
  'inline-flex items-center justify-center gap-2 rounded-full border border-line bg-card px-4 py-1.5 text-sm font-semibold text-strong transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50';
const inputCls =
  'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-strong outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';

const SERVICE: Record<ServiceStatus, { text: string; cls: string }> = {
  ok: { text: 'Готово — приглашения работают', cls: 'border-ok/40 bg-ok/10 text-ok' },
  'not-admin': {
    text: 'Служебный аккаунт не админ в этом тенанте — добавьте его администратором',
    cls: 'border-warn/40 bg-warn/10 text-warn',
  },
  'no-account': {
    text: 'Служебный аккаунт не задан на сервере (XL_JOIN_EMAIL / XL_JOIN_PASSWORD)',
    cls: 'border-warn/40 bg-warn/10 text-warn',
  },
  error: { text: 'Не удалось проверить служебный аккаунт', cls: 'border-danger/40 bg-danger/10 text-danger' },
};

export default function AdminPage() {
  const [opened, setOpened] = useState<JoinTenant[] | null>(null);
  const [mine, setMine] = useState<Tenant[]>([]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    joinAdmin.list().then(setOpened, (e: Error) => {
      setOpened([]);
      setError(e.message);
    });
    myTenants().then(setMine, () => setMine([]));
  }, []);

  const openIds = new Set((opened ?? []).map((t) => t.id));
  const available = mine.filter((t) => !openIds.has(t.id));

  const run = async (key: string, action: () => Promise<JoinTenant[]>) => {
    setBusy(key);
    setError(null);
    try {
      setOpened(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (tenant: JoinTenant) => {
    try {
      await navigator.clipboard.writeText(joinLink(tenant.key));
      setCopied(tenant.id);
      window.setTimeout(() => setCopied((c) => (c === tenant.id ? null : c)), 1500);
    } catch {
      /* буфер обмена недоступен — ссылку видно в поле */
    }
  };

  return (
    <div className="flex flex-col gap-[var(--ui-gap)]">
      <div>
        <h2 className="text-2xl font-extrabold text-strong">Админка</h2>
        <p className="text-sm text-muted">Настройки игры, доступные фасилитатору.</p>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h3 className="mb-1 font-semibold text-strong">Вход по ссылке</h3>
        <p className="mb-4 text-sm text-muted">
          Участники открывают ссылку, вводят почту и получают доступ к тенанту — без вашего участия. Вход
          работает только в тенанты из этого списка; открыть или закрыть его может админ тенанта.
        </p>

        {error ? (
          <div data-testid="admin-error" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            data-testid="admin-tenant-pick"
            className={`${inputCls} sm:max-w-sm`}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">{available.length ? 'Выберите тенант…' : 'Все ваши тенанты уже открыты'}</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.key})
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="admin-tenant-open"
            className={btnPrimary}
            disabled={!pick || busy !== null}
            onClick={() => run('open', () => joinAdmin.open(pick)).then(() => setPick(''))}
          >
            {busy === 'open' ? 'Открываем…' : 'Открыть вход'}
          </button>
        </div>

        {opened === null ? (
          <p className="text-sm text-muted">Загружаем список…</p>
        ) : opened.length === 0 ? (
          <p data-testid="admin-tenants-empty" className="rounded-lg bg-soft px-4 py-3 text-sm text-muted">
            Вход по ссылке пока никуда не открыт.
          </p>
        ) : (
          <ul data-testid="admin-tenants" className="space-y-3">
            {opened.map((t) => (
              <li key={t.id} className="rounded-xl border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-strong">
                      {t.name} <span className="font-normal text-muted">· {t.key}</span>
                    </p>
                    <p className="text-caption text-faint">
                      открыл {t.addedBy}, {new Date(t.addedAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={btnOutline}
                    disabled={busy !== null}
                    onClick={() => run(t.id, () => joinAdmin.close(t.id))}
                  >
                    {busy === t.id ? 'Закрываем…' : 'Закрыть вход'}
                  </button>
                </div>
                <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                  <input readOnly className={`${inputCls} font-mono`} value={joinLink(t.key)} onFocus={(e) => e.target.select()} />
                  <button type="button" className={btnOutline} onClick={() => copy(t)}>
                    {copied === t.id ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
                <p className={`inline-block rounded-full border px-2.5 py-0.5 text-caption font-semibold ${SERVICE[t.service].cls}`}>
                  {SERVICE[t.service].text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
