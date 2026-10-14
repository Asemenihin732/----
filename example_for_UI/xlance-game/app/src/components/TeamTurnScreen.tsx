import { projects } from '../data/projects'
import { useGameStore } from '../store/gameStore'
import { PlanBudgetPanel } from './PlanBudgetPanel'
import { CardGrid } from './CardGrid'
import { CardDetail } from './CardDetail'
import { formatSignedDays, formatSignedPct, formatSignedRub } from '../store/kpi'

export function TeamTurnScreen() {
  const round = useGameStore((s) => s.round)
  const totalRounds = useGameStore((s) => s.totalRounds)
  const teamIndex = useGameStore((s) => s.teamIndex)
  const activeTeams = useGameStore((s) => s.activeTeams)
  const currentTeamId = useGameStore((s) => s.currentTeamId())
  const team = useGameStore((s) => s.teams[s.currentTeamId()])
  const cards = useGameStore((s) => s.currentCards())
  const selectedCard = useGameStore((s) => s.selectedCard())
  const selectCard = useGameStore((s) => s.selectCard)
  const chooseVariant = useGameStore((s) => s.chooseVariant)
  const advanceAfterTurn = useGameStore((s) => s.advanceAfterTurn)
  const resolvedThisRound = useGameStore((s) => s.resolvedThisRound)

  const project = projects.find((p) => p.id === currentTeamId)!
  const hasResolved = resolvedThisRound.has(currentTeamId)
  const lastDecision = hasResolved ? team.decisions.at(-1) : undefined

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <span>Раунд {round} / {totalRounds}</span>
            <span className="text-white/20">·</span>
            <span>
              Команда {teamIndex + 1} / {activeTeams.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {activeTeams.map((id) => (
              <span
                key={id}
                className={`h-1.5 w-6 rounded-full ${
                  id === currentTeamId
                    ? 'bg-indigo-400'
                    : resolvedThisRound.has(id)
                      ? 'bg-white/40'
                      : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        <PlanBudgetPanel project={project} team={team} />

        <div className="mt-8">
          {!hasResolved && !selectedCard && (
            <>
              <h3 className="text-sm uppercase tracking-wide text-white/40 mb-3 text-center">
                Выберите одну из четырёх карт проблемы
              </h3>
              <CardGrid cards={cards} accent={project.accent} onPick={selectCard} />
            </>
          )}

          {!hasResolved && selectedCard && (
            <CardDetail card={selectedCard} accent={project.accent} onChoose={chooseVariant} />
          )}

          {hasResolved && lastDecision && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Решение принято</p>
              <p className="text-white font-semibold mb-2">
                «{lastDecision.cardTitle}» → вариант {lastDecision.variantKey}: {lastDecision.variantLabel}
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs mb-6">
                {lastDecision.deltaDays !== 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/60">
                    {formatSignedDays(lastDecision.deltaDays)} к сроку
                  </span>
                )}
                {lastDecision.deltaCost !== 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/60">
                    {formatSignedRub(lastDecision.deltaCost)} расход
                  </span>
                )}
                {lastDecision.deltaRevenue !== 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/60">
                    {formatSignedRub(lastDecision.deltaRevenue)} доход
                  </span>
                )}
                {lastDecision.deltaSatisfaction !== 0 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/60">
                    {formatSignedPct(lastDecision.deltaSatisfaction)} удовл.
                  </span>
                )}
              </div>
              <button
                onClick={advanceAfterTurn}
                className="rounded-full bg-indigo-500 hover:bg-indigo-400 transition px-8 py-3 text-white font-semibold shadow-lg shadow-indigo-500/30"
              >
                {teamIndex + 1 < activeTeams.length ? 'Следующая команда →' : 'К табло результатов →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
