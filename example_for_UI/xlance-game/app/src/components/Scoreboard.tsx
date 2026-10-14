import { motion } from 'framer-motion'
import { projects } from '../data/projects'
import { computeKpi } from '../store/kpi'
import { accentFor } from '../data/theme'
import { formatPct, formatRub } from '../store/kpi'
import type { TeamId, TeamState } from '../types/game'

interface Row {
  teamId: TeamId
  name: string
  emoji: string
  accent: string
  scheduleKpi: number
  marginKpi: number
  satisfactionKpi: number
  index: number
  marginRub: number
}

export function buildRows(teams: Record<TeamId, TeamState>, teamIds: TeamId[]): Row[] {
  return teamIds.map((id) => {
    const project = projects.find((p) => p.id === id)!
    const team = teams[id]
    const kpi = computeKpi(team)
    return {
      teamId: id,
      name: project.name,
      emoji: project.emoji,
      accent: project.accent,
      scheduleKpi: kpi.scheduleKpi,
      marginKpi: kpi.marginKpi,
      satisfactionKpi: kpi.satisfactionKpi,
      index: kpi.index,
      marginRub: team.factIncome - team.factCost,
    }
  }).sort((a, b) => b.index - a.index)
}

export function Scoreboard({
  teams,
  teamIds,
  highlightWinner,
  showMarginRub,
}: {
  teams: Record<TeamId, TeamState>
  teamIds: TeamId[]
  highlightWinner?: boolean
  showMarginRub?: boolean
}) {
  const rows = buildRows(teams, teamIds)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-white/40 uppercase text-[11px] tracking-wide bg-black/20">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Команда</th>
            <th className="px-4 py-3">Срок</th>
            <th className="px-4 py-3">Маржа</th>
            {showMarginRub && <th className="px-4 py-3">Маржа, ₽</th>}
            <th className="px-4 py-3">Удовл.</th>
            <th className="px-4 py-3">Индекс</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const theme = accentFor(row.accent)
            const isLeader = i === 0 && highlightWinner
            return (
              <motion.tr
                key={row.teamId}
                layout
                className={`border-t border-white/5 ${isLeader ? 'bg-white/10' : ''}`}
              >
                <td className="px-4 py-3 font-semibold text-white/50">{i + 1}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span>{row.emoji}</span>
                    <span className={`font-medium ${isLeader ? 'text-white' : 'text-white/80'}`}>
                      {row.name}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-white/70">{formatPct(row.scheduleKpi)}</td>
                <td className="px-4 py-3 text-white/70">{formatPct(row.marginKpi)}</td>
                {showMarginRub && (
                  <td className="px-4 py-3 text-white/70">{formatRub(row.marginRub)}</td>
                )}
                <td className="px-4 py-3 text-white/70">{formatPct(row.satisfactionKpi)}</td>
                <td className={`px-4 py-3 font-bold ${theme.text}`}>{formatPct(row.index)}</td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
