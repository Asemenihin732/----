import { motion } from 'framer-motion';
import { getProject, type TeamId } from '../data/projects';
import { computeKpi, formatMoney, formatPct } from '../game/engine';
import { accentFor } from '../data/theme';
import type { TeamProgress } from '../game/types';

interface Row {
  teamId: TeamId;
  name: string;
  emoji: string;
  accent: string;
  scheduleKpi: number;
  marginKpi: number;
  satisfactionKpi: number;
  index: number;
  marginRub: number;
}

export function buildRows(teams: Record<TeamId, TeamProgress>, teamIds: TeamId[]): Row[] {
  return teamIds
    .map((id) => {
      const project = getProject(id);
      const team = teams[id];
      const kpi = computeKpi(team);
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
      };
    })
    .sort((a, b) => b.index - a.index);
}

export function Scoreboard({
  teams,
  teamIds,
  highlightWinner,
  showMarginRub,
}: {
  teams: Record<TeamId, TeamProgress>;
  teamIds: TeamId[];
  highlightWinner?: boolean;
  showMarginRub?: boolean;
}) {
  const rows = buildRows(teams, teamIds);

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-soft text-left text-caption uppercase tracking-wide text-muted">
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
            const theme = accentFor(row.accent);
            const isLeader = i === 0 && highlightWinner;
            return (
              <motion.tr
                key={row.teamId}
                layout
                className={`border-t border-line ${isLeader ? 'bg-soft2' : ''}`}
              >
                <td className="px-4 py-3 font-semibold text-muted">{i + 1}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span>{row.emoji}</span>
                    <span className={`font-medium ${isLeader ? 'text-strong' : 'text-body'}`}>{row.name}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-body">{formatPct(row.scheduleKpi)}</td>
                <td className="px-4 py-3 text-body">{formatPct(row.marginKpi)}</td>
                {showMarginRub && <td className="px-4 py-3 text-body">{formatMoney(row.marginRub)}</td>}
                <td className="px-4 py-3 text-body">{formatPct(row.satisfactionKpi)}</td>
                <td className={`px-4 py-3 font-bold ${theme.text}`}>{formatPct(row.index)}</td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
