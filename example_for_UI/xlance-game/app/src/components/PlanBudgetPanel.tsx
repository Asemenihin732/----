import type { ProjectPlan, TeamState } from '../types/game'
import { accentFor } from '../data/theme'
import { formatRub, formatPct } from '../store/kpi'

interface Props {
  project: ProjectPlan
  team: TeamState
}

export function PlanBudgetPanel({ project, team }: Props) {
  const accent = accentFor(project.accent)
  const factMarginPct =
    team.factIncome > 0 ? ((team.factIncome - team.factCost) / team.factIncome) * 100 : -100
  const daysChanged = team.factDurationDays !== team.baseDurationDays
  const costChanged = team.factCost !== team.baseCost
  const incomeChanged = team.factIncome !== team.baseIncome

  return (
    <div className={`rounded-2xl border ${accent.border} bg-white/5 p-5`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{project.emoji}</span>
            <h2 className="text-xl font-semibold text-white">{project.name}</h2>
          </div>
          <p className="mt-1 text-sm text-white/60 max-w-xl">{project.feature}</p>
        </div>

        <div className="flex gap-3">
          <Metric
            label="Срок"
            value={`${fmtDays(team.factDurationDays)} дн.`}
            sub={daysChanged ? `план ${fmtDays(team.baseDurationDays)}` : 'по плану'}
            changed={daysChanged}
          />
          <Metric
            label="Маржа"
            value={formatPct(factMarginPct)}
            sub={`план ${formatPct((team.baseIncome > 0 ? (team.baseIncome - team.baseCost) / team.baseIncome : 0) * 100)}`}
            changed={Math.round(factMarginPct) !== Math.round(project.baseMarginPct)}
          />
          <Metric
            label="Удовл."
            value={formatPct(team.satisfaction)}
            sub="старт 100%"
            changed={team.satisfaction !== 100}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">
            Диаграмма Ганта
          </h3>
          <ul className="space-y-1">
            {project.tasks.map((t, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-1.5"
              >
                <span className="text-white/80">{t.task}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {t.note && (
                    <span className="text-[10px] uppercase tracking-wide text-white/40">
                      {t.note}
                    </span>
                  )}
                  <span className={`text-xs font-medium ${accent.text}`}>{t.day}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">
            Бюджет
          </h3>
          <ul className="space-y-1">
            {project.budgetItems.map((b, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-1.5"
              >
                <span className="text-white/80">{b.label}</span>
                <span className="text-white/50">{formatRub(b.cost)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className={`rounded-full px-3 py-1 ${accent.bgSoft} ${accent.text}`}>
              Доход: {formatRub(team.factIncome)}
              {incomeChanged && (
                <span className="text-white/40"> (план {formatRub(team.baseIncome)})</span>
              )}
            </span>
            <span className={`rounded-full px-3 py-1 ${accent.bgSoft} ${accent.text}`}>
              Расход: {formatRub(team.factCost)}
              {costChanged && (
                <span className="text-white/40"> (план {formatRub(team.baseCost)})</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function fmtDays(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

function Metric({
  label,
  value,
  sub,
  changed,
}: {
  label: string
  value: string
  sub: string
  changed: boolean
}) {
  return (
    <div className="text-center bg-black/20 rounded-xl px-4 py-2 min-w-[92px]">
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`text-lg font-bold ${changed ? 'text-white' : 'text-white/70'}`}>
        {value}
      </div>
      <div className="text-[10px] text-white/35">{sub}</div>
    </div>
  )
}
