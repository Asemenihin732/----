import type { DecisionLogEntry, KpiResult, RoundNumber } from '../types/game'
import { formatRub } from './kpi'

export interface RoundStats {
  count: number
  costDelta: number
  revenueDelta: number
  daysDelta: number
  satisfactionDelta: number
  changeRequestsMade: number
  missedChangeRequests: number
  riskCardsHandledCheaply: number
}

function summarize(decisions: DecisionLogEntry[]): RoundStats {
  const stats: RoundStats = {
    count: decisions.length,
    costDelta: 0,
    revenueDelta: 0,
    daysDelta: 0,
    satisfactionDelta: 0,
    changeRequestsMade: 0,
    missedChangeRequests: 0,
    riskCardsHandledCheaply: 0,
  }
  for (const d of decisions) {
    stats.costDelta += d.deltaCost
    stats.revenueDelta += d.deltaRevenue
    stats.daysDelta += d.deltaDays
    stats.satisfactionDelta += d.deltaSatisfaction
    if (d.isChangeRequest) stats.changeRequestsMade += 1
    if (d.hadChangeRequestOption && !d.isChangeRequest) stats.missedChangeRequests += 1
    if (d.category === 'FORS_MAJOR' && d.deltaCost <= 0 && d.deltaSatisfaction <= -15) {
      stats.riskCardsHandledCheaply += 1
    }
  }
  return stats
}

function fmtDays(n: number): string {
  const abs = Math.abs(n)
  const str = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace('.', ',')
  return str
}

/** Короткая сводка решений одной команды за один раунд — для табло после раунда. */
export function roundInsight(decisions: DecisionLogEntry[], round: RoundNumber): string {
  const roundDecisions = decisions.filter((d) => d.round === round)
  const stats = summarize(roundDecisions)
  if (stats.count === 0) return 'Решений в этом раунде не зафиксировано.'

  const parts: string[] = []
  if (stats.changeRequestsMade > 0) {
    parts.push(
      `оформили ${stats.changeRequestsMade} запрос${stats.changeRequestsMade > 1 ? 'а' : ''} на изменение`,
    )
  }
  if (stats.missedChangeRequests > 0) {
    parts.push(`${stats.missedChangeRequests} раз рост объёма остался неоформленным`)
  }
  if (stats.satisfactionDelta <= -10) {
    parts.push(`потеряли ${Math.abs(stats.satisfactionDelta)} п.п. удовлетворённости`)
  } else if (stats.satisfactionDelta >= 10) {
    parts.push(`укрепили доверие заказчика (+${stats.satisfactionDelta} п.п.)`)
  }
  if (stats.daysDelta > 0) {
    parts.push(`срок вырос на ${fmtDays(stats.daysDelta)} дн.`)
  } else if (stats.daysDelta < 0) {
    parts.push(`сократили срок на ${fmtDays(Math.abs(stats.daysDelta))} дн.`)
  }
  const netCost = stats.costDelta - stats.revenueDelta
  if (netCost > 0) {
    parts.push(`расходы превысили доход по раунду на ${formatRub(netCost)}`)
  } else if (netCost < 0) {
    parts.push(`доход перекрыл расходы раунда (+${formatRub(Math.abs(netCost))})`)
  }

  if (parts.length === 0) return 'Раунд прошёл почти без отклонений от плана.'
  return `За раунд: ${parts.join(', ')}.`
}

export interface TeamAnalysis {
  headline: string
  strengths: string[]
  improvements: string[]
}

function tradeoffHeadline(kpi: KpiResult): string {
  const entries = [
    { name: 'срок', value: kpi.scheduleKpi },
    { name: 'маржу', value: kpi.marginKpi },
    { name: 'удовлетворённость', value: kpi.satisfactionKpi },
  ]
  const sorted = [...entries].sort((a, b) => b.value - a.value)
  const best = sorted[0]
  const worst = sorted[2]
  if (best.value - worst.value < 12) {
    return 'Команда удержала баланс проектного треугольника: срок, маржа и удовлетворённость почти не разошлись.'
  }
  return `Классический компромисс проектного треугольника PMBOK: вытянули ${best.name} (${Math.round(best.value)}%), заплатив за это через ${worst.name} (${Math.round(worst.value)}%).`
}

/** Полный разбор команды по итогам всей игры (или на момент вызова) для табло/итогов. */
export function analyzeTeam(allDecisions: DecisionLogEntry[], kpi: KpiResult): TeamAnalysis {
  const stats = summarize(allDecisions)
  const strengths: string[] = []
  const improvements: string[] = []

  if (stats.changeRequestsMade > 0) {
    strengths.push(
      `Оформили ${stats.changeRequestsMade} запрос${stats.changeRequestsMade > 1 ? 'а' : ''} на изменение — рост объёма по инициативе заказчика попал в доход, а не осел скрытым перерасходом (Integrated Change Control, PMBOK).`,
    )
  }
  if (kpi.scheduleKpi >= 100) {
    strengths.push('Уложились в срок или опередили план — критический путь держали под контролем (Schedule Management).')
  }
  if (kpi.marginKpi >= 100) {
    strengths.push('Фактическая маржинальность не хуже плановой — непредвиденные расходы покрывались доходом или резервом, а не съедали прибыль (Cost Management).')
  }
  if (kpi.satisfactionKpi >= 100) {
    strengths.push('Удовлетворённость заказчика выше стартовой — команда системно выбирала клиентоориентированные варианты (Stakeholder Engagement).')
  }
  if (stats.count > 0 && stats.satisfactionDelta >= 0 && kpi.satisfactionKpi < 100) {
    strengths.push('В сумме решения не били по отношениям с заказчиком сильнее, чем требовала ситуация.')
  }
  if (strengths.length === 0) {
    strengths.push('Явных провалов нет, но и системного преимущества команда пока не создала — см. рекомендации ниже.')
  }

  if (stats.missedChangeRequests > 0) {
    improvements.push(
      `${stats.missedChangeRequests} раз объём работ вырос по инициативе заказчика, но запрос на изменение не оформлялся — расход лёг на факт без покрытия доходом. По Scope/Cost Management такие случаи стоит формализовывать сразу же, а не постфактум.`,
    )
  }
  if (kpi.scheduleKpi < 90) {
    improvements.push(
      `Срок просел до ${Math.round(kpi.scheduleKpi)}% от плана — стоит закладывать буфер на критическом пути (contingency reserve, Schedule Management) вместо разовых компенсаций по факту происшествий.`,
    )
  }
  if (kpi.marginKpi < 90) {
    improvements.push(
      `Маржа просела до ${Math.round(kpi.marginKpi)}% от плана — управленческий резерв на непредвиденные расходы (management reserve, Cost Management) смягчил бы удар по прибыли.`,
    )
  }
  if (kpi.satisfactionKpi < 90) {
    improvements.push(
      `Удовлетворённость упала до ${Math.round(kpi.satisfactionKpi)}% — по Stakeholder Engagement дешевле предупредить заказчика заранее (правило фасилитатора: +5 п.п. за раннее предупреждение), чем экономить и получать штраф к отношениям.`,
    )
  }
  if (stats.riskCardsHandledCheaply > 0) {
    improvements.push(
      `В ${stats.riskCardsHandledCheaply} форс-мажорных ситуациях выбран самый дешёвый вариант ценой резкого падения удовлетворённости — по Risk Management полезно иметь заранее продуманный план реагирования (response plan) на такие риски, а не решать по остаточному принципу.`,
    )
  }
  if (improvements.length === 0) {
    improvements.push('Существенных точек роста не видно — команда действовала сбалансированно во всех трёх измерениях проекта.')
  }

  return { headline: tradeoffHeadline(kpi), strengths, improvements }
}
