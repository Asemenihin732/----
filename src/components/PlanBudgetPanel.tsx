import type { Project, TeamId } from '../data/projects';
import type { TeamProgress } from '../game/types';
import { accentFor } from '../data/theme';
import { formatPct, formatRub, teamTotals } from '../game/engine';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useSession } from '../game/store';
import { getProject } from '../data/projects';

import type { XlFinance, XlGanttTask, XlIndicator, XlResource } from '../api/types';
import { cardsFor } from '../data/cards';
import { api } from '../api/api';
import GanttChart from './GanttChart';

interface Props {
  project: Project;
  team: TeamProgress;
}

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

export function PlanBudgetPanel({ project, team }: Props) {
  const accent = accentFor(project.accent);
  const factMarginPct =
    team.factIncome > 0 ? ((team.factIncome - team.factCost) / team.factIncome) * 100 : -100;
  const planMarginPct =
    team.baseIncome > 0 ? ((team.baseIncome - team.baseCost) / team.baseIncome) * 100 : 0;
  const daysChanged = team.factDurationDays !== team.baseDurationDays;
  const costChanged = team.factCost !== team.baseCost;
  const incomeChanged = team.factIncome !== team.baseIncome;

  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useSession();

  const id = (teamId ?? '') as TeamId;
  const inSession = state.teamOrder.includes(id);
  
  const [gantt, setGantt] = useState<XlGanttTask[] | null>(null);
  const [resources, setResources] = useState<XlResource[] | null>(null);
  const [finance, setFinance] = useState<XlFinance | null>(null);
  const [indicators, setIndicators] = useState<XlIndicator[] | null>(null);
  const [pickedCardId, setPickedCardId] = useState<string | null>(null);
  
  const round = state.round as Round;
  const deck = useMemo(() => cardsFor(id, round), [id, round]);
  const decisionsCount = team?.decisions.length ?? 0;
  const roundDecision = decisionsCount >= round;

  const totals = teamTotals(project.id, team);

  useEffect(() => {
      if (!inSession || !id) return;
      let alive = true;
      setGantt(null);
      (async () => {
        try {
          const [g] = await Promise.all([
            api.gantt.tasks(id),
          ]);
          if (!alive) return;
          setGantt(g);
         
        } catch {
          if (!alive) return;
          setGantt(fallbackWorks(id));
        }
      })();
      return () => {
        alive = false;
      };
  }, [id, inSession, decisionsCount]);


  return (
    <div className={`rounded-2xl border bg-card p-5 ${accent.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{project.emoji}</span>
            <h2 className="text-xl font-semibold text-strong">{project.name}</h2>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted">{project.feature}</p>
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
            sub={`план ${formatPct(planMarginPct)}`}
            changed={Math.round(factMarginPct) !== Math.round(planMarginPct)}
          />
          <Metric
            label="Удовл."
            value={formatPct(team.satisfaction)}
            sub="старт 100%"
            changed={team.satisfaction !== 100}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Диаграмма Ганта
          </h3>
          {/* <ul className="space-y-1">
            {project.works.map((t, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-soft px-3 py-1.5 text-sm"
              >
                <span className="text-body">{t.task}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {t.note && (
                    <span className="text-[10px] uppercase tracking-wide text-faint">{t.note}</span>
                  )}
                  <span className={`text-xs font-medium ${accent.text}`}>{t.period}</span>
                </span>
              </li>
            ))}
          </ul> */}
            {gantt ? (
                        <GanttChart tasks={gantt} baseDays={totals.baseDays} actualDays={totals.actualDays} />
                      ) : (
                        <p className="py-6 text-center text-sm text-muted">Загружаем план из X-Lance…</p>
                      )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Бюджет</h3>
          <ul className="space-y-1">
            {project.budget.map((b, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-soft px-3 py-1.5 text-sm"
              >
                <span className="text-body">{b.item}</span>
                <span className="text-muted">{formatRub(b.cost)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className={`rounded-full px-3 py-1 ${accent.bgSoft} ${accent.text}`}>
              Доход: {formatRub(team.factIncome)}
              {incomeChanged && (
                <span className="text-faint"> (план {formatRub(team.baseIncome)})</span>
              )}
            </span>
            <span className={`rounded-full px-3 py-1 ${accent.bgSoft} ${accent.text}`}>
              Расход: {formatRub(team.factCost)}
              {costChanged && <span className="text-faint"> (план {formatRub(team.baseCost)})</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDays(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

function Metric({
  label,
  value,
  sub,
  changed,
}: {
  label: string;
  value: string;
  sub: string;
  changed: boolean;
}) {
  return (
    <div className="min-w-[92px] rounded-xl bg-soft px-4 py-2 text-center">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-lg font-bold ${changed ? 'text-strong' : 'text-body'}`}>{value}</div>
      <div className="text-[10px] text-faint">{sub}</div>
    </div>
  );
}
