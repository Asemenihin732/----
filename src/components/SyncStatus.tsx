/**
 * Статус отправки решения в X-Lance: сколько финансовых пунктов заведено,
 * что не получилось и кнопка «Повторить» — повторяются только неудачные пункты.
 */
import { useState } from 'react';
import { useSyncReport } from '../api/syncReports';

interface Props {
  teamId: string;
  round: number;
  /** Повторить пункты с этими ключами; не задано — повтор недоступен */
  onRetry?: (keys: string[]) => Promise<unknown>;
}

export function SyncStatus({ teamId, round, onRetry }: Props) {
  const report = useSyncReport(teamId, round);
  const [retrying, setRetrying] = useState(false);

  if (!report) {
    return (
      <p data-testid="sync-status" data-state="none" className="text-caption text-faint">
        X-Lance: нет данных об отправке решения
      </p>
    );
  }
  if (report.pending) {
    return (
      <p data-testid="sync-status" data-state="pending" className="text-caption text-muted">
        X-Lance: заводим решение…
      </p>
    );
  }

  const money = report.items.filter((i) => i.financial);
  const moneyOk = money.filter((i) => i.ok).length;
  const failed = report.items.filter((i) => !i.ok);
  const moneyFailed = failed.filter((i) => i.financial);

  const retry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry(failed.map((i) => i.key));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      data-testid="sync-status"
      data-state={moneyFailed.length > 0 ? 'failed' : 'ok'}
      className={`mx-auto mb-5 max-w-xl rounded-lg border px-4 py-3 text-left text-sm ${
        moneyFailed.length > 0 ? 'border-danger/40 bg-danger/10' : 'border-line bg-card'
      }`}
    >
      <p className="mb-1 text-caption font-semibold uppercase tracking-wide text-muted">
        X-Lance ·{' '}
        {money.length === 0
          ? 'финансовых изменений нет'
          : moneyFailed.length === 0
            ? `финансы заведены (${moneyOk} из ${money.length})`
            : `финансы заведены не полностью (${moneyOk} из ${money.length})`}
      </p>
      {failed.length > 0 ? (
        <>
          <ul className="space-y-0.5">
            {failed.map((item) => (
              <li key={item.key} className={item.financial ? 'text-danger' : 'text-muted'}>
                ✕ {item.label}
                {item.error ? <span className="block text-caption opacity-80">{item.error}</span> : null}
              </li>
            ))}
          </ul>
          {onRetry ? (
            <button
              type="button"
              onClick={retry}
              disabled={retrying}
              className="mt-2 rounded-full border border-line bg-card px-4 py-1 text-sm font-semibold text-strong transition hover:bg-soft disabled:opacity-50"
            >
              {retrying ? 'Повторяем…' : 'Повторить неудачные'}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
