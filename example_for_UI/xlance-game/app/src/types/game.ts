export type TeamId =
  | 'catering'
  | 'stage'
  | 'entertainment'
  | 'merch'
  | 'logistics'
  | 'afterparty'

export type RoundNumber = 1 | 2 | 3

export type CardCategory =
  | 'LUDI'
  | 'PODRYADCHIKI'
  | 'ZAKAZCHIK'
  | 'FORS_MAJOR'
  | 'RESURSY'
  | 'UNIVERSAL'
  | 'BONUS'

export interface Variant {
  key: 'A' | 'B' | 'C'
  label: string
  deltaDays?: number
  deltaCost?: number
  deltaRevenue?: number
  deltaSatisfaction?: number
  isChangeRequest?: boolean
  xlanceAction: string
  xlanceSteps?: string[]
}

export interface Card {
  id: string
  team: TeamId | 'universal'
  round: RoundNumber | null
  category: CardCategory
  title: string
  flavor: string
  variants: Variant[]
}

export interface TaskItem {
  day: string
  task: string
  note?: string
}

export interface BudgetItem {
  label: string
  calc?: string
  cost: number
}

export interface ProjectPlan {
  id: TeamId
  name: string
  emoji: string
  accent: string // tailwind color name, e.g. 'orange'
  feature: string
  income: number
  baseCost: number
  baseMarginPct: number
  baseDurationDays: number
  tasks: TaskItem[]
  budgetItems: BudgetItem[]
}

export interface DecisionLogEntry {
  round: RoundNumber
  cardTitle: string
  category: CardCategory
  variantKey: 'A' | 'B' | 'C'
  variantLabel: string
  deltaDays: number
  deltaCost: number
  deltaRevenue: number
  deltaSatisfaction: number
  isChangeRequest: boolean
  hadChangeRequestOption: boolean
}

export interface TeamState {
  id: TeamId
  name: string
  factDurationDays: number
  baseDurationDays: number
  factIncome: number
  factCost: number
  baseIncome: number
  baseCost: number
  satisfaction: number
  decisions: DecisionLogEntry[]
  changeRequestsApproved: number
}

export interface KpiResult {
  scheduleKpi: number
  marginKpi: number
  satisfactionKpi: number
  index: number
  factMarginPct: number
  baseMarginPct: number
}

export type GamePhase =
  | 'intro'
  | 'team-turn'
  | 'round-dashboard'
  | 'final-results'
