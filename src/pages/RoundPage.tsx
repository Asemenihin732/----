/**
 * Табло после раунда: ранжирование команд и короткий разбор решений.
 */
import { useNavigate } from 'react-router-dom';
import { useSession } from '../game/store';
import { Scoreboard, buildRows } from '../components/Scoreboard';
import { roundInsight } from '../game/analysis';
import { accentFor } from '../data/theme';
import type { RoundNumber } from '../game/types';

export default function RoundPage() {
  const { state, dispatch } = useSession();
  const navigate = useNavigate();
  const round = state.round as RoundNumber;

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

  const rows = buildRows(state.teams, state.teamOrder);
  const isLastRound = state.round >= state.roundCount;

  const next = () => {
    dispatch({ type: 'advanceRound' });
    if (isLastRound) navigate('/results');
    else navigate(`/team/${state.teamOrder[0]}`);
  };

  return (
    <div className="py-4">
      <p className="mb-2 text-center text-sm uppercase tracking-[0.3em] text-brand">Табло результатов</p>
      <h1 className="mb-8 text-center text-3xl font-bold text-strong">Раунд {round} завершён</h1>

      <Scoreboard teams={state.teams} teamIds={state.teamOrder} />

      <h2 className="mb-3 mt-10 text-sm uppercase tracking-wide text-muted">Разбор раунда</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((row) => {
          const theme = accentFor(row.accent);
          const team = state.teams[row.teamId];
          return (
            <div key={row.teamId} className="rounded-xl border border-line bg-card p-4">
              <div className="mb-1 flex items-center gap-2">
                <span>{row.emoji}</span>
                <span className={`font-semibold ${theme.text}`}>{row.name}</span>
              </div>
              <p className="text-sm text-muted">{roundInsight(team.decisions, round)}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          data-testid="round-next"
          onClick={next}
          className="rounded-full bg-brand px-8 py-3 font-semibold text-white shadow-lg shadow-brand/30 transition hover:brightness-110"
        >
          {isLastRound ? 'Итоги игры →' : `Раунд ${round + 1} →`}
        </button>
      </div>
    </div>
  );
}
