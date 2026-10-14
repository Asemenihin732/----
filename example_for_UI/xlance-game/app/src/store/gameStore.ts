import { create } from 'zustand'
import { projects } from '../data/projects'
import { cardsFor } from '../data/cards'
import { designatedCard } from '../data/deck'
import type { Card, GamePhase, RoundNumber, TeamId, TeamState, Variant } from '../types/game'
import { clampSatisfaction } from './kpi'

const TEAM_ORDER: TeamId[] = [
  'catering',
  'stage',
  'entertainment',
  'merch',
  'logistics',
  'afterparty',
]

function initialTeamState(id: TeamId): TeamState {
  const project = projects.find((p) => p.id === id)!
  return {
    id,
    name: project.name,
    factDurationDays: project.baseDurationDays,
    baseDurationDays: project.baseDurationDays,
    factIncome: project.income,
    factCost: project.baseCost,
    baseIncome: project.income,
    baseCost: project.baseCost,
    satisfaction: 100,
    decisions: [],
    changeRequestsApproved: 0,
  }
}

interface GameStore {
  phase: GamePhase
  round: RoundNumber
  totalRounds: number
  teamIndex: number
  activeTeams: TeamId[]
  teams: Record<TeamId, TeamState>
  roundCards: Record<TeamId, Card[]>
  selectedCardId: string | null
  resolvedThisRound: Set<TeamId>

  currentTeamId: () => TeamId
  currentTeam: () => TeamState
  currentCards: () => Card[]
  selectedCard: () => Card | null

  startGame: (teamCount: number, rounds: number) => void
  selectCard: (cardId: string) => void
  chooseVariant: (variant: Variant) => void
  advanceAfterTurn: () => void
  goToNextRound: () => void
  restart: () => void
}

function buildRoundCards(round: RoundNumber, activeTeams: TeamId[]): Record<TeamId, Card[]> {
  const map = {} as Record<TeamId, Card[]>
  for (const team of activeTeams) {
    map[team] = cardsFor(team, round)
  }
  return map
}

function freshTeams(activeTeams: TeamId[]): Record<TeamId, TeamState> {
  const map = {} as Record<TeamId, TeamState>
  for (const team of activeTeams) {
    map[team] = initialTeamState(team)
  }
  return map
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'intro',
  round: 1,
  totalRounds: 3,
  teamIndex: 0,
  activeTeams: TEAM_ORDER,
  teams: freshTeams(TEAM_ORDER),
  roundCards: buildRoundCards(1, TEAM_ORDER),
  selectedCardId: null,
  resolvedThisRound: new Set(),

  currentTeamId: () => get().activeTeams[get().teamIndex],
  currentTeam: () => get().teams[get().currentTeamId()],
  currentCards: () => get().roundCards[get().currentTeamId()],
  selectedCard: () => {
    const id = get().selectedCardId
    if (!id) return null
    const fixed = designatedCard(get().currentTeamId(), get().round)
    if (fixed) return fixed
    return get().currentCards().find((c) => c.id === id) ?? null
  },

  startGame: (teamCount, rounds) => {
    const activeTeams = TEAM_ORDER.slice(0, Math.max(1, Math.min(TEAM_ORDER.length, teamCount)))
    const totalRounds = Math.max(1, Math.min(3, rounds))
    set({
      phase: 'team-turn',
      round: 1,
      totalRounds,
      teamIndex: 0,
      activeTeams,
      teams: freshTeams(activeTeams),
      roundCards: buildRoundCards(1, activeTeams),
      selectedCardId: null,
      resolvedThisRound: new Set(),
    })
  },

  selectCard: (cardId) => set({ selectedCardId: cardId }),

  chooseVariant: (variant) => {
    const state = get()
    const teamId = state.currentTeamId()
    const card = state.selectedCard()
    if (!card) return

    const team = state.teams[teamId]
    const deltaDays = variant.deltaDays ?? 0
    const deltaCost = variant.deltaCost ?? 0
    const deltaRevenue = variant.deltaRevenue ?? 0
    const deltaSatisfaction = variant.deltaSatisfaction ?? 0

    const updated: TeamState = {
      ...team,
      factDurationDays: team.factDurationDays + deltaDays,
      factCost: team.factCost + deltaCost,
      factIncome: team.factIncome + deltaRevenue,
      satisfaction: clampSatisfaction(team.satisfaction + deltaSatisfaction),
      baseDurationDays: team.baseDurationDays + (variant.isChangeRequest ? deltaDays : 0),
      baseIncome: team.baseIncome + (variant.isChangeRequest ? deltaRevenue : 0),
      baseCost: team.baseCost + (variant.isChangeRequest ? deltaCost : 0),
      changeRequestsApproved: team.changeRequestsApproved + (variant.isChangeRequest ? 1 : 0),
      decisions: [
        ...team.decisions,
        {
          round: state.round,
          cardTitle: card.title,
          category: card.category,
          variantKey: variant.key,
          variantLabel: variant.label,
          deltaDays,
          deltaCost,
          deltaRevenue,
          deltaSatisfaction,
          isChangeRequest: !!variant.isChangeRequest,
          hadChangeRequestOption: card.variants.some((v) => v.isChangeRequest),
        },
      ],
    }

    const resolved = new Set(state.resolvedThisRound)
    resolved.add(teamId)

    set({
      teams: { ...state.teams, [teamId]: updated },
      resolvedThisRound: resolved,
      selectedCardId: null,
    })
  },

  advanceAfterTurn: () => {
    const state = get()
    const nextIndex = state.teamIndex + 1
    if (nextIndex >= state.activeTeams.length) {
      set({ phase: 'round-dashboard' })
    } else {
      set({ teamIndex: nextIndex, selectedCardId: null })
    }
  },

  goToNextRound: () => {
    const state = get()
    if (state.round >= state.totalRounds) {
      set({ phase: 'final-results' })
      return
    }
    const nextRound = (state.round + 1) as RoundNumber
    set({
      phase: 'team-turn',
      round: nextRound,
      teamIndex: 0,
      roundCards: buildRoundCards(nextRound, state.activeTeams),
      resolvedThisRound: new Set(),
      selectedCardId: null,
    })
  },

  restart: () =>
    set({
      phase: 'intro',
      round: 1,
      teamIndex: 0,
      teams: freshTeams(get().activeTeams),
      roundCards: buildRoundCards(1, get().activeTeams),
      selectedCardId: null,
      resolvedThisRound: new Set(),
    }),
}))

export const TEAM_ORDER_LIST = TEAM_ORDER
