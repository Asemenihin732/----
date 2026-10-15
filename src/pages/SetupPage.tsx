/**
 * Старт: выбираем число раундов и число команд, при желании разворачиваем
 * пространство в X-Lance — и играем.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROJECTS } from '../data/projects';
import { useSession } from '../game/store';
import { useAuth } from '../auth/AuthProvider';
import { formatMoney } from '../game/engine';
import { LEGEND, ROUND_XLANCE_ACTION } from '../data/gameData';
import { loadProvisionResult, provisionGame, type ProvisionResult } from '../api/provision';

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50';
const btnOutline =
  'inline-flex items-center justify-center gap-2 rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-strong transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50';
const inputCls =
  'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-strong outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';

export default function SetupPage() {
  const { state, dispatch } = useSession();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(PROJECTS.slice(0, 2).map((p) => p.id)),
  );

  const teamIds = PROJECTS.map((p) => p.id).filter((id) => selected.has(id));
  const decisions = teamIds.length * rounds;
  const canStart = teamIds.length > 0 && rounds > 0;
  const resumable = state.teamOrder.length > 0 && !state.finished;

  /* ------------------------- развёртывание в X-Lance ------------------------ */
  const [tenantName, setTenantName] = useState(() => loadProvisionResult()?.tenantName ?? 'Игра');
  const [tenantKey, setTenantKey] = useState(() => loadProvisionResult()?.tenantKey ?? 'IG');
  const [provisioning, setProvisioning] = useState(false);
  const [, setLog] = useState<string[]>([]);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(() =>
    loadProvisionResult(),
  );

  const provision = async () => {
    if (!canStart || provisioning) return;
    setProvisioning(true);
    setProvisionError(null);
    setLog([]);
    setProvisionResult(null);
    try {
      const result = await provisionGame({
        tenantName: tenantName.trim(),
        tenantKey: tenantKey.trim() || undefined,
        teamIds,
        onProgress: (message) => setLog((prev) => [...prev, message]),
      });
      setProvisionResult(result);
    } catch (e) {
      setProvisionError(e instanceof Error ? e.message : String(e));
    } finally {
      setProvisioning(false);
    }
  };

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
};

  const start = () => {
    if (!canStart) return;
    dispatch({ type: 'configure', roundCount: rounds, teamIds });
    navigate(`/team/${teamIds[0]}`);
  };

  return (
    <>
      {/* ------------------------------ легенда -------------------------------- */}
      <section className="mb-6 rounded-3xl bg-gradient-to-br from-[#212346] via-[#2a2a63] to-[#6270d0] p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#9ea8e2]">
          X-Lance · Деловая игра · методичка v4.0
        </p>
        <h2 className="mt-1 text-3xl font-extrabold">Спаси конференцию!</h2>
        <p className="mt-3 max-w-3xl text-sm text-white/85">{LEGEND}</p>
      </section>

      <div className="bg-card border rounded-2xl border-line">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 rounded-2xl" >
        {/* ------------------------------ раунды ------------------------------- */}
        <section className="rounded-2xl bg-card p-5">
          <h3 className="mb-1 font-semibold text-strong">1. Сколько раундов играем</h3>
          <p className="mb-4 text-sm text-muted">
            В каждом раунде команда открывает одну карточку из четырёх и принимает решение.
          </p>
          <div className="flex gap-2">
            {[1, 2, 3].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRounds(r)}
                className={`h-10 w-10 rounded-full text-sm font-semibold transition ${
                  r === rounds ? 'bg-brand text-white' : 'bg-soft text-muted hover:bg-soft2'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {([1, 2, 3] as const).map((r) => (
              <div key={r} className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    rounds >= r ? 'bg-brand text-white' : 'border border-line text-muted'
                  }`}
                >
                  Раунд {r}
                </span>
                <span className="text-sm text-muted">{ROUND_XLANCE_ACTION[r]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------ команды ------------------------------ */}
        <section className="rounded-2xl bg-card p-5">
          <h3 className="mb-1 font-semibold text-strong">2. Сколько команд играет</h3>
          <p className="mb-4 text-sm text-muted">
            Каждой команде — свой проект и своя колода карточек.
          </p>
          <div className="space-y-1.5">
            {PROJECTS.map((p) => {
              const on = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    })
                  }
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                    on ? 'border-brand bg-brand/5' : 'border-line opacity-60 hover:opacity-100'
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${
                      on ? 'border-brand bg-brand text-white' : 'border-line text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-strong">
                      {p.emoji} {p.number}. {p.shortName}
                    </span>
                    <span className="block text-xs text-muted">
                      {formatMoney(p.baseIncome)} · маржа {p.baseMarginPct}% · {p.baseDurationDays} дн.
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
            

      

      
     
      
        </section>
      </div>
                     {/* ---------------------------- развёртывание ---------------------------- */}
      <section className="mt-5 rounded-2xl  p-5">
        <h3 className="mb-1 font-semibold text-strong">3. Развернуть в X-Lance</h3>
        <p className="mb-4 text-sm text-muted">
          Создаёт тенант (или переиспользует существующий), проекты-команды, задачи работ из планов
          (со связями и трудозатратами, без родительской задачи) и ресурсы со стоимостью. Повторный
          запуск приводит задачи к плану, не дублируя их. Вы вошли как{' '}
          <b className="text-strong">
            {user ? `${user.firstName} ${user.lastName}`.trim() || user.email : '—'}
          </b>
          .
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block text-xs font-semibold text-muted">Тенант</span>
            <input
              className={inputCls}
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
            />
          </label>
          <label className="text-sm sm:w-32">
            <span className="mb-1 block text-xs font-semibold text-muted">Ключ</span>
            <input
              className={inputCls}
              value={tenantKey}
              onChange={(e) => setTenantKey(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={btnOutline}
            disabled={!canStart || provisioning}
            onClick={provision}
          >
            {provisioning ? 'Разворачиваем…' : 'Создать в X-Lance'}
          </button>
          <button
            type="button"
            className={btnOutline}
            onClick={() => openInNewTab(`https://preview.x-lance.ru/${tenantKey.trim() || tenantName.trim()}`)}
          >
            Открыть X-Lance
          </button>
        </div>

        {provisioning ? (
          <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-brand/40" />
        ) : null}

        {/* {log.length > 0 ? (
          <div className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-soft p-3 font-mono text-xs text-body">
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        ) : null} */}

        {provisionError ? (
          <div className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {provisionError}
          </div>
        ) : null}

        {provisionResult ? (
          <div className="mt-3 rounded-xl border border-ok/40 bg-ok/10 p-3 text-sm text-ok">
            Тенант «{provisionResult.tenantName}»
            {provisionResult.createdTenant ? ' (создан)' : ' (переиспользован)'}: проектов —{' '}
            {provisionResult.teams.length}, задач — {provisionResult.taskCount}, ресурсов —{' '}
            {provisionResult.resourceCount}.
          </div>
        ) : null}
      </section>

      {/* ------------------------------- запуск -------------------------------- */}
      <section className="mt-5 rounded-2xl p-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-bold text-strong">
              Итого: {teamIds.length} команд × {rounds} раундов = {decisions} решений
            </p>
            <p className="text-sm text-muted">
              Каждое решение меняет срок, расход, доход и удовлетворённость заказчика — а значит и
              индекс проекта.
            </p>
          </div>
          <button type="button" className={btnPrimary} disabled={!canStart} onClick={start}>
            Начать игру
          </button>
        </div>
      </section>
      </div>
      
      

      {resumable ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm text-body">
          <span className="flex-1">
            Сессия уже идёт: раунд {state.round} из {state.roundCount}, команд —{' '}
            {state.teamOrder.length}.
          </span>
          <button
            type="button"
            className={btnOutline}
            onClick={() => navigate(`/team/${state.teamOrder[state.currentTeamIndex]}`)}
          >
            Продолжить
          </button>
        </div>
      ) : null}
    </>
  );
}
