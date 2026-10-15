/**
 * Экран команды в раунде:
 * план и бюджет проекта, метрики, Ганта + ресурсы и финансы X-Lance,
 * снизу — четыре перевёрнутые карточки; выбранная разворачивается в блок решений.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import GanttChart from '../components/GanttChart';
import { PlanBudgetPanel } from '../components/PlanBudgetPanel';
import { CardGrid } from '../components/CardGrid';
import { CardDetail } from '../components/CardDetail';
import { StatBox } from '../components/ui';
import { getProject, type TeamId } from '../data/projects';
import { cardsFor } from '../data/cards';
import { designatedCard } from '../data/deck';
import { useSession } from '../game/store';
import {
  formatDeltaDays,
  formatDeltaMoney,
  formatDays,
  formatMoney,
  formatPct,
  formatSignedDays,
  formatSignedPct,
  formatSignedRub,
  teamTotals,
} from '../game/engine';
import { api } from '../api/api';
import { syncDecisionToXl } from '../api/decisionSync';
import { ROUND_XLANCE_ACTION } from '../data/gameData';
import type { Card, RoundDecision, Variant } from '../game/types';
import type { XlFinance, XlGanttTask, XlIndicator, XlResource } from '../api/types';

type Round = 1 | 2 | 3;

/** Локальный фолбэк по works проекта */
function fallbackWorks(projectId: TeamId): XlGanttTask[] {
  const p = getProject(projectId);
  return p.works.map((w, i) => {
    const days = (w.period.match(/\d+/g) ?? ['1']).map(Number);
    return {
      id: `w-${i}`,
      name: w.task,
      startDay: Math.min(...days),
      endDay: Math.max(...days),
      critical:
        w.note === 'критический путь' ||
        w.note === 'точка невозврата' ||
        w.note === 'внешняя зависимость',
      dependsOn: [],
    };
  });
}

export default function TeamRoundPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useSession();

  const id = (teamId ?? '') as TeamId;
  const inSession = state.teamOrder.includes(id);
  const team = inSession ? state.teams[id] : null;
  const project = inSession ? getProject(id) : null;

  const [gantt, setGantt] = useState<XlGanttTask[] | null>(null);
  const [resources, setResources] = useState<XlResource[] | null>(null);
  const [finance, setFinance] = useState<XlFinance | null>(null);
  const [indicators, setIndicators] = useState<XlIndicator[] | null>(null);
  const [pickedCardId, setPickedCardId] = useState<string | null>(null);

  const round = state.round as Round;
  const deck = useMemo(() => cardsFor(id, round), [id, round]);
  const decisionsCount = team?.decisions.length ?? 0;
  const roundDecision = decisionsCount >= round;

  /* ------------------------------ данные из API ----------------------------- */
  useEffect(() => {
    if (!inSession || !id) return;
    let alive = true;
    setGantt(null);
    setResources(null);
    (async () => {
      try {
        const [g, r, f, i] = await Promise.all([
          api.gantt.tasks(id),
          api.resources.list(id),
          api.finance.get(id),
          api.indicators.list(id),
        ]);
        if (!alive) return;
        setGantt(g);
        setResources(r);
        setFinance(f);
        setIndicators(i);
      } catch {
        if (!alive) return;
        setGantt(fallbackWorks(id));
        setResources(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, inSession, decisionsCount]);

  /* --------------------------- выбранная карточка ---------------------------- */
  const card: Card | null = useMemo(() => {
    if (!pickedCardId) return null;
    const fixed = designatedCard(id, round);
    if (fixed) return fixed;
    return deck.find((c) => c.id === pickedCardId) ?? null;
  }, [pickedCardId, id, round, deck]);

  /* ------------------------------- навигация -------------------------------- */
  const idx = state.teamOrder.indexOf(id);
  const isLastTeam = idx === state.teamOrder.length - 1;

  const goToTeam = (target: number) => {
    const targetId = state.teamOrder[target];
    if (!targetId) return;
    dispatch({ type: 'goto', index: target });
    navigate(`/team/${targetId}`);
  };

  const goNext = () => {
    dispatch({ type: 'goto', index: Math.min(idx + 1, state.teamOrder.length - 1) });
    if (isLastTeam) navigate('/round');
    else navigate(`/team/${state.teamOrder[idx + 1]}`);
  };

  if (!inSession || !team || !project) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm text-body">
        <span className="flex-1">Команда не найдена в текущей сессии.</span>
        <button
          type="button"
          className="rounded-full border border-line bg-card px-4 py-1.5 font-semibold"
          onClick={() => navigate('/')}
        >
          К выбору игры
        </button>
      </div>
    );
  }

  const totals = teamTotals(project.id, team);
  const satisfaction =
    indicators?.find((i) => i.key === 'customer-satisfaction')?.value ?? team.satisfaction;
  const decisionThisRound = team.decisions.find((d) => d.round === round) ?? null;

  const chooseVariant = (variant: Variant) => {
    if (!card) return;
    const decision: RoundDecision = {
      round,
      cardTitle: card.title,
      category: card.category,
      variantKey: variant.key,
      variantLabel: variant.label,
      deltaDays: variant.deltaDays ?? 0,
      deltaCost: variant.deltaCost ?? 0,
      deltaRevenue: variant.deltaRevenue ?? 0,
      deltaSatisfaction: variant.deltaSatisfaction ?? 0,
      isChangeRequest: Boolean(variant.isChangeRequest),
      hadChangeRequestOption: card.variants.some((v) => v.isChangeRequest),
      targetTask: variant.targetTask,
    };
    dispatch({ type: 'submit', teamId: project.id, decision });
    // фиксируем действие в X-Lance (mock/http — по режиму)
    void syncDecisionToXl({
      teamId: project.id,
      card,
      variant,
      decision,
      satisfactionBefore: team.satisfaction,
    });
    setPickedCardId(null);
  };

  return (
    <>
      {/* ------------------------------ шапка ---------------------------------- */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>
            Раунд {state.round} / {state.roundCount}
          </span>
          <span className="text-faint">·</span>
          <span>
            Команда {idx + 1} / {state.teamOrder.length}
          </span>
          <span className="ml-2 hidden rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-muted sm:inline">
            X-Lance: {ROUND_XLANCE_ACTION[round]}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {state.teamOrder.map((t) => {
              const done = (state.teams[t]?.decisions.length ?? 0) >= round;
              return (
                <span
                  key={t}
                  title={getProject(t).shortName}
                  className={`h-1.5 w-7 rounded-full ${
                    t === id ? 'bg-brand' : done ? 'bg-body' : 'bg-line'
                  }`}
                />
              );
            })}
          </div>
          {state.teamOrder.length > 1 ? (
            <div className="flex gap-1">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-card text-strong disabled:opacity-40"
                disabled={idx === 0}
                onClick={() => goToTeam(idx - 1)}
              >
                ←
              </button>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-card text-strong disabled:opacity-40"
                disabled={isLastTeam}
                onClick={() => goToTeam(idx + 1)}
              >
                →
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* --------------------------- план и бюджет ------------------------------ */}
      <PlanBudgetPanel project={project} team={team} />

      {/* ----------------------------- метрики --------------------------------- */}
      {/* <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div
          className="rounded-2xl border border-line bg-card p-4"
          style={{ backgroundImage: 'linear-gradient(180deg, rgba(98,112,208,0.12), transparent)' }}
        >
          <div className="text-xs font-bold text-muted">Индекс проекта</div>
          <div className="text-xl font-extrabold text-brand">{formatPct(totals.index)}</div>
          <div className="text-xs text-muted">
            Срок {formatPct(totals.kpiDays)} · Маржа {formatPct(totals.kpiMargin)} · Удовл.{' '}
            {formatPct(totals.kpiSatisfaction)}
          </div>
        </div>
        <StatBox
          label="Срок"
          value={`${formatDays(totals.actualDays)} дн.`}
          hint={`база ${totals.baseDays} дн. · ${formatDeltaDays(totals.actualDays - totals.baseDays)}`}
        />
        <StatBox
          label="Маржинальность"
          value={formatPct(totals.actualMarginPct, 1)}
          hint={`план ${totals.baseMarginPct}% · ${formatMoney(totals.actualMargin)}`}
        />
        <StatBox label="Удовлетворённость" value={`${satisfaction} %`} hint="коридор 40–130 %" />
      </div> */}

      {/* --------------------- Ганта + ресурсы и финансы ----------------------- */}
      {/* <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-line bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-strong">
                {project.number}. {project.name}
              </h3>
              <p className="text-xs text-muted">{project.feature}</p>
            </div>
            <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
              X-Lance: {MODULE_LABELS.gantt}
            </span>
          </div>
          <div className="mb-3 h-px bg-line" />
          {gantt ? (
            <GanttChart tasks={gantt} baseDays={totals.baseDays} actualDays={totals.actualDays} />
          ) : (
            <p className="py-6 text-center text-sm text-muted">Загружаем план из X-Lance…</p>
          )}
        </section> */}

        {/* <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-card p-5">
            <h3 className="mb-3 text-sm font-extrabold text-strong">Стоимость ресурсов</h3>
            {resources && resources.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-1">Ресурс</th>
                    <th className="pb-1 text-right">Ставка</th>
                    <th className="pb-1 text-right">Дни</th>
                    <th className="pb-1 text-right">Стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td className="py-1.5 text-body">{r.name}</td>
                      <td className="py-1.5 text-right text-body">{formatMoney(r.rate)}</td>
                      <td className="py-1.5 text-right text-body">{r.days}</td>
                      <td className="py-1.5 text-right text-body">{formatMoney(r.rate * r.days)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-line font-extrabold">
                    <td className="py-1.5 text-strong" colSpan={3}>
                      Итого ресурсы
                    </td>
                    <td className="py-1.5 text-right text-strong">
                      {formatMoney(resources.reduce((s, r) => s + r.rate * r.days, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-1">Статья</th>
                    <th className="pb-1 text-right">Стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {project.budget.map((b) => (
                    <tr key={b.item} className="border-t border-line">
                      <td className="py-1.5 text-body">{b.item}</td>
                      <td className="py-1.5 text-right text-body">{formatMoney(b.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section> 

           <section className="rounded-2xl border border-line bg-card p-5">
            <h3 className="mb-2 text-sm font-extrabold text-strong">Финансы</h3>
            <div className="space-y-1.5">
              <FinRow
                label="Доход"
                value={formatMoney(totals.actualIncome)}
                hint={`план ${formatMoney(totals.baseIncome)}`}
              />
              <FinRow
                label="Себестоимость"
                value={formatMoney(totals.actualCost)}
                hint={`план ${formatMoney(totals.baseCost)}`}
              />
              <FinRow
                label="Маржа"
                value={formatMoney(totals.actualMargin)}
                hint={`план ${formatMoney(totals.baseMargin)}`}
              />
              {team.decisions.length > 0 ? (
                <FinRow
                  label="Эффект решений"
                  value={`${formatDeltaDays(totals.actualDays - totals.baseDays)} · ${formatDeltaMoney(
                    totals.actualCost - totals.baseCost,
                  )}`}
                  hint={`доход ${formatDeltaMoney(totals.actualIncome - totals.baseIncome)}`}
                />
              ) : null}
            </div>
            {finance ? (
              <p className="mt-2 text-xs text-muted">
                X-Lance: доход {formatMoney(finance.income)} · расход {formatMoney(finance.cost)} ·
                маржа {formatPct(finance.marginPct, 1)}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted">
              Действие в X-Lance за раунд: {ROUND_XLANCE_ACTION[round]}
              {api.meta.isMock ? ' · демо-режим' : ''}
            </p>
          </section>
        </div> */}
      {/* </div>  */}

      {/* ------------------------------- карточки ------------------------------- */}
      <section className="mt-5 rounded-2xl border border-line bg-card p-5">
        <h3 className="mb-1 text-sm font-extrabold text-strong">Карточка раунда</h3>
        <p className="mb-4 text-sm text-muted">
          Четыре карты лежат рубашкой вверх. Выберите ровно одну — она развернётся, и вы примете
          решение.
        </p>

        {roundDecision && decisionThisRound ? (
          <div className="rounded-xl border border-ok/40 bg-ok/10 p-5 text-center">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted">Решение принято</p>
            <p className="mb-2 font-semibold text-strong">
              «{decisionThisRound.cardTitle}» → вариант {decisionThisRound.variantKey}:{' '}
              {decisionThisRound.variantLabel}
            </p>
            <div className="mb-5 flex flex-wrap justify-center gap-2 text-xs">
              {decisionThisRound.deltaDays !== 0 && (
                <span className="rounded-full bg-soft px-2 py-0.5 text-muted">
                  {formatSignedDays(decisionThisRound.deltaDays)} к сроку
                </span>
              )}
              {decisionThisRound.deltaCost !== 0 && (
                <span className="rounded-full bg-soft px-2 py-0.5 text-muted">
                  {formatSignedRub(decisionThisRound.deltaCost)} расход
                </span>
              )}
              {decisionThisRound.deltaRevenue !== 0 && (
                <span className="rounded-full bg-soft px-2 py-0.5 text-muted">
                  {formatSignedRub(decisionThisRound.deltaRevenue)} доход
                </span>
              )}
              {decisionThisRound.deltaSatisfaction !== 0 && (
                <span className="rounded-full bg-soft px-2 py-0.5 text-muted">
                  {formatSignedPct(decisionThisRound.deltaSatisfaction)} удовл.
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={goNext}
              className="rounded-full bg-brand px-8 py-3 font-semibold text-white shadow-lg shadow-brand/30 transition hover:brightness-110"
            >
              {isLastTeam ? 'К табло результатов →' : 'Следующая команда →'}
            </button>
          </div>
        ) : card ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <CardDetail card={card} accent={project.accent} onChoose={chooseVariant} />
          </motion.div>
        ) : (
          <CardGrid cards={deck} accent={project.accent} onPick={setPickedCardId} />
        )}
      </section>
    </>
  );
}

/* ----------------------------- подкомпоненты ------------------------------- */

function FinRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
        <span className="font-extrabold text-strong">{value}</span>
      </span>
    </div>
  );
}
