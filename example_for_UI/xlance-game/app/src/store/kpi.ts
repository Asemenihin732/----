import type { KpiResult, TeamState } from '../types/game'

export function computeKpi(team: TeamState): KpiResult {
  const scheduleKpi = (team.baseDurationDays / team.factDurationDays) * 100

  const factMarginPct =
    team.factIncome > 0 ? ((team.factIncome - team.factCost) / team.factIncome) * 100 : -100
  const baseMarginPct =
    team.baseIncome > 0 ? ((team.baseIncome - team.baseCost) / team.baseIncome) * 100 : 0

  const marginKpi = factMarginPct <= 0 ? 0 : (factMarginPct / baseMarginPct) * 100
  const satisfactionKpi = team.satisfaction

  const index = (scheduleKpi + marginKpi + satisfactionKpi) / 3

  return { scheduleKpi, marginKpi, satisfactionKpi, index, factMarginPct, baseMarginPct }
}

export function clampSatisfaction(value: number): number {
  return Math.min(130, Math.max(40, value))
}

export function formatRub(value: number): string {
  const sign = value < 0 ? '−' : ''
  return `${sign}${Math.abs(Math.round(value)).toLocaleString('ru-RU')} ₽`
}

export function formatSignedRub(value: number): string {
  if (value === 0) return '0 ₽'
  const sign = value > 0 ? '+' : '−'
  return `${sign}${Math.abs(Math.round(value)).toLocaleString('ru-RU')} ₽`
}

export function formatSignedDays(value: number): string {
  if (value === 0) return '0 дн.'
  const sign = value > 0 ? '+' : '−'
  const abs = Math.abs(value)
  const str = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace('.', ',')
  return `${sign}${str} дн.`
}

export function formatSignedPct(value: number): string {
  if (value === 0) return '0 п.п.'
  const sign = value > 0 ? '+' : '−'
  return `${sign}${Math.abs(value)} п.п.`
}

export function formatPct(value: number): string {
  return `${value.toFixed(0)}%`
}
