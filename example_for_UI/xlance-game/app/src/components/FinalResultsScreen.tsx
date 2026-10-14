import { useGameStore } from '../store/gameStore'
import { Scoreboard } from './Scoreboard'
import { projects } from '../data/projects'
import { computeKpi, formatPct, formatRub } from '../store/kpi'
import { analyzeTeam } from '../store/analysis'
import { accentFor } from '../data/theme'

export function FinalResultsScreen() {
  const teams = useGameStore((s) => s.teams)
  const activeTeams = useGameStore((s) => s.activeTeams)
  const restart = useGameStore((s) => s.restart)

  const enriched = activeTeams.map((id) => {
    const project = projects.find((p) => p.id === id)!
    const team = teams[id]
    return { id, project, team, kpi: computeKpi(team) }
  })

  const byIndex = [...enriched].sort((a, b) => b.kpi.index - a.kpi.index)
  const winner = byIndex[0]
  const favorite = [...enriched].sort((a, b) => b.team.satisfaction - a.team.satisfaction)[0]
  const disciplined = [...enriched].sort((a, b) => b.kpi.factMarginPct - a.kpi.factMarginPct)[0]
  const negotiator = [...enriched].sort(
    (a, b) => b.team.changeRequestsApproved - a.team.changeRequestsApproved,
  )[0]

  return (
    <div className="min-h-screen px-6 py-10 flex flex-col items-center">
      <div className="max-w-4xl w-full">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-400 mb-2 text-center">
          Итоги игры
        </p>
        <h1 className="text-3xl font-bold text-white mb-2 text-center">
          {winner.project.emoji} Гран-при: {winner.project.name}
        </h1>
        <p className="text-center text-white/50 mb-8">
          Индекс проекта — {formatPct(winner.kpi.index)}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Nomination
            title="Любимец заказчика"
            value={`${favorite.project.emoji} ${favorite.project.name}`}
            sub={`удовлетворённость ${formatPct(favorite.team.satisfaction)}`}
          />
          <Nomination
            title="Финансовая дисциплина"
            value={`${disciplined.project.emoji} ${disciplined.project.name}`}
            sub={`факт. маржа ${formatPct(disciplined.kpi.factMarginPct)} · ${formatRub(disciplined.team.factIncome - disciplined.team.factCost)}`}
          />
          <Nomination
            title="Мастер переговоров"
            value={`${negotiator.project.emoji} ${negotiator.project.name}`}
            sub={`${negotiator.team.changeRequestsApproved} запросов на изменение`}
          />
        </div>

        <Scoreboard teams={teams} teamIds={activeTeams} highlightWinner showMarginRub />

        <h2 className="text-sm uppercase tracking-wide text-white/40 mt-10 mb-3">
          Разбор по командам (PMBOK)
        </h2>
        <div className="space-y-4">
          {byIndex.map(({ id, project, team, kpi }, i) => {
            const theme = accentFor(project.accent)
            const analysis = analyzeTeam(team.decisions, kpi)
            const marginRub = team.factIncome - team.factCost
            return (
              <div key={id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-white/30 text-sm font-semibold">#{i + 1}</span>
                  <span>{project.emoji}</span>
                  <span className={`font-semibold ${theme.text}`}>{project.name}</span>
                  <span className="ml-auto flex items-center gap-3 text-sm text-white/40">
                    <span>индекс {formatPct(kpi.index)}</span>
                    <span>
                      заработали {formatRub(marginRub)} ({formatPct(kpi.factMarginPct)})
                    </span>
                  </span>
                </div>
                <p className="text-white/70 text-sm mb-3">{analysis.headline}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-emerald-400 mb-1.5">
                      Что сработало
                    </p>
                    <ul className="space-y-1.5">
                      {analysis.strengths.map((s, idx) => (
                        <li key={idx} className="text-sm text-white/60 flex gap-2">
                          <span className="text-emerald-400 shrink-0">✓</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-amber-400 mb-1.5">
                      Что усилить в следующий раз
                    </p>
                    <ul className="space-y-1.5">
                      {analysis.improvements.map((s, idx) => (
                        <li key={idx} className="text-sm text-white/60 flex gap-2">
                          <span className="text-amber-400 shrink-0">→</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={restart}
            className="rounded-full border border-white/20 hover:border-white/40 transition px-8 py-3 text-white/80 font-semibold"
          >
            Новая партия
          </button>
        </div>
      </div>
    </div>
  )
}

function Nomination({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
      <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1">{title}</div>
      <div className="text-white font-semibold">{value}</div>
      <div className="text-xs text-white/40 mt-0.5">{sub}</div>
    </div>
  )
}
