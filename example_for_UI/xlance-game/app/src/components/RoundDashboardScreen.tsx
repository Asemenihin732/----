import { useGameStore } from '../store/gameStore'
import { Scoreboard, buildRows } from './Scoreboard'
import { roundInsight } from '../store/analysis'
import { accentFor } from '../data/theme'

export function RoundDashboardScreen() {
  const round = useGameStore((s) => s.round)
  const totalRounds = useGameStore((s) => s.totalRounds)
  const teams = useGameStore((s) => s.teams)
  const activeTeams = useGameStore((s) => s.activeTeams)
  const goToNextRound = useGameStore((s) => s.goToNextRound)

  const rows = buildRows(teams, activeTeams)

  return (
    <div className="min-h-screen px-6 py-10 flex flex-col items-center">
      <div className="max-w-4xl w-full">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-400 mb-2 text-center">
          Табло результатов
        </p>
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Раунд {round} завершён
        </h1>

        <Scoreboard teams={teams} teamIds={activeTeams} />

        <h2 className="text-sm uppercase tracking-wide text-white/40 mt-10 mb-3">
          Разбор раунда
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((row) => {
            const theme = accentFor(row.accent)
            const team = teams[row.teamId]
            return (
              <div key={row.teamId} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span>{row.emoji}</span>
                  <span className={`font-semibold ${theme.text}`}>{row.name}</span>
                </div>
                <p className="text-sm text-white/60">{roundInsight(team.decisions, round)}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={goToNextRound}
            className="rounded-full bg-indigo-500 hover:bg-indigo-400 transition px-8 py-3 text-white font-semibold shadow-lg shadow-indigo-500/30"
          >
            {round < totalRounds ? `Раунд ${round + 1} →` : 'Итоги игры →'}
          </button>
        </div>
      </div>
    </div>
  )
}
