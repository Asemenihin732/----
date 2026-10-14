/**
 * Игровой движок: KPI и индекс проекта (методичка, разделы 2 и 10).
 * Индекс проекта = (KPI Срок + KPI Маржинальность + KPI Удовлетворённость) ÷ 3.
 *
 * Перенесено из нового интерфейса: базовый план хранится прямо в прогрессе
 * команды, поэтому «запрос на изменение» может сдвигать базу, а KPI считается
 * относительно актуального базового плана.
 */
import { getProject, type TeamId } from '../data/projects';
import type { KpiResult, RoundDecision, TeamProgress } from './types';

/* ------------------------------- форматирование ------------------------------ */

const moneyFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const daysFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

/** 1200000 → «1 200 000 ₽» */
export function formatMoney(v: number): string {
  const sign = v < 0 ? '−' : '';
  return `${sign}${moneyFmt.format(Math.abs(Math.round(v)))} ₽`;
}

/** Алиас из нового интерфейса */
export const formatRub = formatMoney;

/** 25 → «25 %» */
export function formatPct(v: number, digits = 0): string {
  const rounded = digits === 0 ? Math.round(v) : +v.toFixed(digits);
  return `${pctFmt.format(rounded)} %`;
}

/** 6.5 → «6,5» */
export function formatDays(v: number): string {
  return daysFmt.format(v).replace('.', ',');
}

export function formatDeltaMoney(v: number): string {
  if (v === 0) return '—';
  return `${v > 0 ? '+' : '−'}${moneyFmt.format(Math.abs(v))} ₽`;
}

export function formatDeltaDays(v: number): string {
  if (v === 0) return '—';
  return `${v > 0 ? '+' : '−'}${daysFmt.format(Math.abs(v)).replace('.', ',')} дн.`;
}

export function formatDeltaPp(v: number): string {
  if (v === 0) return '—';
  return `${v > 0 ? '+' : '−'}${Math.abs(v)} п.п.`;
}

/* --------------------- форматтеры из нового интерфейса ---------------------- */

/** «+50 000 ₽» / «−50 000 ₽» / «0 ₽» */
export function formatSignedRub(value: number): string {
  if (value === 0) return '0 ₽';
  const sign = value > 0 ? '+' : '−';
  return `${sign}${moneyFmt.format(Math.abs(Math.round(value)))} ₽`;
}

export function formatSignedDays(value: number): string {
  if (value === 0) return '0 дн.';
  const sign = value > 0 ? '+' : '−';
  const abs = Math.abs(value);
  const str = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace('.', ',');
  return `${sign}${str} дн.`;
}

export function formatSignedPct(value: number): string {
  if (value === 0) return '0 п.п.';
  const sign = value > 0 ? '+' : '−';
  return `${sign}${Math.abs(value)} п.п.`;
}

/* --------------------------------- расчёты ---------------------------------- */

export function clampSatisfaction(value: number): number {
  return Math.min(130, Math.max(40, Math.round(value)));
}

/** KPI и индекс одной команды (по её текущему прогрессу) */
export function computeKpi(team: TeamProgress): KpiResult {
  const scheduleKpi = (team.baseDurationDays / Math.max(team.factDurationDays, 0.5)) * 100;

  const factMarginPct =
    team.factIncome > 0 ? ((team.factIncome - team.factCost) / team.factIncome) * 100 : -100;
  const baseMarginPct =
    team.baseIncome > 0 ? ((team.baseIncome - team.baseCost) / team.baseIncome) * 100 : 0;

  const marginKpi = factMarginPct <= 0 ? 0 : (factMarginPct / baseMarginPct) * 100;
  const satisfactionKpi = team.satisfaction;
  const index = (scheduleKpi + marginKpi + satisfactionKpi) / 3;

  return { scheduleKpi, marginKpi, satisfactionKpi, index, factMarginPct, baseMarginPct };
}

export interface TeamTotals {
  teamId: TeamId;
  baseDays: number;
  actualDays: number;
  baseIncome: number;
  actualIncome: number;
  baseCost: number;
  actualCost: number;
  baseMargin: number;
  actualMargin: number;
  baseMarginPct: number;
  actualMarginPct: number;
  satisfaction: number;
  kpiDays: number;
  kpiMargin: number;
  kpiSatisfaction: number;
  index: number;
}

/** Итоги команды по её прогрессу (совместимо с mock-бэкендом и отчётами) */
export function teamTotals(teamId: TeamId, progress: TeamProgress): TeamTotals {
  const project = getProject(teamId);
  const baseDays = progress.baseDurationDays ?? project.baseDurationDays;
  const actualDays = progress.factDurationDays ?? project.baseDurationDays;
  const baseIncome = progress.baseIncome ?? project.baseIncome;
  const baseCost = progress.baseCost ?? project.baseCost;
  const actualIncome = progress.factIncome ?? baseIncome;
  const actualCost = progress.factCost ?? baseCost;

  const baseMargin = baseIncome - baseCost;
  const actualMargin = actualIncome - actualCost;
  const baseMarginPct = baseIncome > 0 ? (baseMargin / baseIncome) * 100 : 0;
  const actualMarginPct = actualIncome > 0 ? (actualMargin / actualIncome) * 100 : 0;

  const kpiDays = (baseDays / Math.max(actualDays, 0.5)) * 100;
  const kpiMargin = actualMargin < 0 ? 0 : (actualMarginPct / baseMarginPct) * 100;
  const kpiSatisfaction = progress.satisfaction;
  const index = (kpiDays + kpiMargin + kpiSatisfaction) / 3;

  return {
    teamId,
    baseDays,
    actualDays,
    baseIncome,
    actualIncome,
    baseCost,
    actualCost,
    baseMargin,
    actualMargin,
    baseMarginPct,
    actualMarginPct,
    satisfaction: progress.satisfaction,
    kpiDays,
    kpiMargin,
    kpiSatisfaction,
    index,
  };
}

export interface TeamEntry {
  teamId: TeamId;
  progress: TeamProgress;
}

export interface RankedTeam {
  teamId: TeamId;
  totals: TeamTotals;
  place: number;
}

/** Ранжирование команд по индексу (с учётом ничьих) */
export function rankTeams(entries: TeamEntry[]): RankedTeam[] {
  const rows = entries.map((e) => ({ teamId: e.teamId, totals: teamTotals(e.teamId, e.progress), place: 0 }));
  rows.sort((a, b) => b.totals.index - a.totals.index);
  rows.forEach((row, i) => {
    row.place = i > 0 && rows[i - 1].totals.index === row.totals.index ? rows[i - 1].place : i + 1;
  });
  return rows;
}

export interface Nominations {
  grandPrix: TeamId[];
  customerFavorite: TeamId[];
  financeDiscipline: TeamId[];
  negotiator: TeamId[];
}

export function nominations(entries: TeamEntry[]): Nominations {
  if (entries.length === 0) {
    return { grandPrix: [], customerFavorite: [], financeDiscipline: [], negotiator: [] };
  }
  const totals = entries.map((e) => teamTotals(e.teamId, e.progress));
  const best = (pick: (t: TeamTotals) => number): TeamId[] => {
    const max = Math.max(...totals.map(pick));
    return totals.filter((t) => pick(t) === max).map((t) => t.teamId);
  };
  return {
    grandPrix: best((t) => t.index),
    customerFavorite: best((t) => t.satisfaction),
    financeDiscipline: best((t) => t.actualMarginPct),
    negotiator: best((t) => entries.find((e) => e.teamId === t.teamId)!.progress.changeRequestsApproved),
  };
}

/** Суммарные дельты решений (строка «ИТОГО») */
export function decisionsTotals(decisions: RoundDecision[]) {
  return decisions.reduce(
    (acc, d) => ({
      deltaDays: acc.deltaDays + d.deltaDays,
      deltaCost: acc.deltaCost + d.deltaCost,
      deltaRevenue: acc.deltaRevenue + d.deltaRevenue,
      deltaSatisfaction: acc.deltaSatisfaction + d.deltaSatisfaction,
    }),
    { deltaDays: 0, deltaCost: 0, deltaRevenue: 0, deltaSatisfaction: 0 },
  );
}
