/**
 * Итоги игры: гран-при, номинации, табло и разбор по командам (PMBOK).
 */
import { useNavigate } from 'react-router-dom';
import { useSession } from '../game/store';
import { Scoreboard } from '../components/Scoreboard';
import { getProject } from '../data/projects';
import { computeKpi, formatPct, formatMoney } from '../game/engine';
import { analyzeTeam } from '../game/analysis';
import { accentFor } from '../data/theme';

export default function ResultsPage() {
  const { state, restart } = useSession();
  const navigate = useNavigate();

  if (state.teamOrder.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center text-muted">
        Игра ещё не начата.{' '}
        <button className="font-semibold text-brand underline" onClick={() => navigate('/')}>
          К настройке
        </button>
      </div>
    );
  }

  const enriched = state.teamOrder.map((id) => {
    const project = getProject(id);
    const team = state.teams[id];
    return { id, project, team, kpi: computeKpi(team) };
  });

  const byIndex = [...enriched].sort((a, b) => b.kpi.index - a.kpi.index);
  const winner = byIndex[0];
  const favorite = [...enriched].sort((a, b) => b.team.satisfaction - a.team.satisfaction)[0];
  const disciplined = [...enriched].sort((a, b) => b.kpi.factMarginPct - a.kpi.factMarginPct)[0];
  const negotiator = [...enriched].sort(
    (a, b) => b.team.changeRequestsApproved - a.team.changeRequestsApproved,
  )[0];

  const newGame = () => {
    restart();
    navigate('/');
  };

  return (
    <div className="py-4">
      <p className="mb-2 text-center text-sm uppercase tracking-[0.3em] text-brand">Итоги игры</p>
      <h1 className="mb-2 text-center text-3xl font-bold text-strong">
        {winner.project.emoji} Гран-при: {winner.project.name}
      </h1>
      <p className="mb-8 text-center text-muted">Индекс проекта — {formatPct(winner.kpi.index)}</p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Nomination
          title="Любимец заказчика"
          value={`${favorite.project.emoji} ${favorite.project.name}`}
          sub={`удовлетворённость ${formatPct(favorite.team.satisfaction)}`}
        />
        <Nomination
          title="Финансовая дисциплина"
          value={`${disciplined.project.emoji} ${disciplined.project.name}`}
          sub={`факт. маржа ${formatPct(disciplined.kpi.factMarginPct)} · ${formatMoney(
            disciplined.team.factIncome - disciplined.team.factCost,
          )}`}
        />
        <Nomination
          title="Мастер переговоров"
          value={`${negotiator.project.emoji} ${negotiator.project.name}`}
          sub={`${negotiator.team.changeRequestsApproved} запросов на изменение`}
        />
      </div>

      <Scoreboard
        teams={state.teams}
        teamIds={state.teamOrder}
        highlightWinner
        showMarginRub
      />

      <h2 className="mb-3 mt-10 text-sm uppercase tracking-wide text-muted">
        Разбор по командам (PMBOK)
      </h2>
      <div className="space-y-4">
        {byIndex.map(({ id, project, team, kpi }, i) => {
          const theme = accentFor(project.accent);
          const analysis = analyzeTeam(team.decisions, kpi);
          const marginRub = team.factIncome - team.factCost;
          return (
            <div key={id} className="rounded-2xl border border-line bg-card p-5">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-faint">#{i + 1}</span>
                <span>{project.emoji}</span>
                <span className={`font-semibold ${theme.text}`}>{project.name}</span>
                <span className="ml-auto flex items-center gap-3 text-sm text-muted">
                  <span>индекс {formatPct(kpi.index)}</span>
                  <span>
                    заработали {formatMoney(marginRub)} ({formatPct(kpi.factMarginPct)})
                  </span>
                </span>
              </div>
              <p className="mb-3 text-sm text-body">{analysis.headline}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-emerald-500">
                    Что сработало
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.strengths.map((s, idx) => (
                      <li key={idx} className="flex gap-2 text-sm text-body">
                        <span className="shrink-0 text-emerald-500">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-amber-500">
                    Что усилить в следующий раз
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.improvements.map((s, idx) => (
                      <li key={idx} className="flex gap-2 text-sm text-body">
                        <span className="shrink-0 text-amber-500">→</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={newGame}
          className="rounded-full border border-line px-8 py-3 font-semibold text-body transition hover:bg-soft"
        >
          Новая партия
        </button>
      </div>
    </div>
  );
}

function Nomination({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 text-center">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">{title}</div>
      <div className="font-semibold text-strong">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{sub}</div>
    </div>
  );
}
