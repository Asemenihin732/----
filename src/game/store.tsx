/**
 * Стор сессии: настройка, ход по командам и раундам, решения.
 * Сохраняется в localStorage, навигация — через react-router.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { PROJECT_IDS, getProject, type TeamId } from '../data/projects';
import { clampSatisfaction } from './engine';
import {
  SAT_START,
  type RoundDecision,
  type SessionState,
  type TeamProgress,
} from './types';

export const GAME_STORAGE_KEY = 'xlance-game-v2';
const STATE_VERSION = 3;

/** Начальное состояние команды по её проекту */
export function initTeam(id: TeamId): TeamProgress {
  const project = getProject(id);
  return {
    id,
    name: project.name,
    baseDurationDays: project.baseDurationDays,
    factDurationDays: project.baseDurationDays,
    baseIncome: project.baseIncome,
    baseCost: project.baseCost,
    factIncome: project.baseIncome,
    factCost: project.baseCost,
    satisfaction: SAT_START,
    decisions: [],
    changeRequestsApproved: 0,
  };
}

export function createSession(roundCount: number, teamIds: TeamId[]): SessionState {
  const teams = {} as Record<TeamId, TeamProgress>;
  for (const id of teamIds) teams[id] = initTeam(id);
  return {
    version: STATE_VERSION,
    roundCount: Math.min(Math.max(roundCount, 1), 3),
    round: 1,
    teamOrder: teamIds,
    currentTeamIndex: 0,
    teams,
    finished: false,
    createdAt: Date.now(),
  };
}

/* ------------------------------- действия ---------------------------------- */

export type SessionAction =
  | { type: 'configure'; roundCount: number; teamIds: TeamId[] }
  | { type: 'submit'; teamId: TeamId; decision: RoundDecision }
  | { type: 'advanceTeam' }
  | { type: 'advanceRound' }
  | { type: 'goto'; index: number }
  | { type: 'reset' };

/** Применяет решение к состоянию команды (в т.ч. сдвиг базового плана при запросе на изменение) */
function applyDecision(team: TeamProgress, decision: RoundDecision): TeamProgress {
  const cr = decision.isChangeRequest;
  return {
    ...team,
    factDurationDays: team.factDurationDays + decision.deltaDays,
    factCost: team.factCost + decision.deltaCost,
    factIncome: team.factIncome + decision.deltaRevenue,
    satisfaction: clampSatisfaction(team.satisfaction + decision.deltaSatisfaction),
    baseDurationDays: team.baseDurationDays + (cr ? decision.deltaDays : 0),
    baseIncome: team.baseIncome + (cr ? decision.deltaRevenue : 0),
    baseCost: team.baseCost + (cr ? decision.deltaCost : 0),
    changeRequestsApproved: team.changeRequestsApproved + (cr ? 1 : 0),
    decisions: [...team.decisions, decision],
  };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'configure':
      return createSession(action.roundCount, action.teamIds);

    case 'submit': {
      const team = state.teams[action.teamId];
      if (!team) return state;
      return { ...state, teams: { ...state.teams, [action.teamId]: applyDecision(team, action.decision) } };
    }

    case 'advanceTeam': {
      const nextIndex = state.currentTeamIndex + 1;
      return { ...state, currentTeamIndex: Math.min(nextIndex, Math.max(state.teamOrder.length - 1, 0)) };
    }

    case 'advanceRound': {
      if (state.round >= state.roundCount) return { ...state, finished: true };
      return { ...state, round: state.round + 1, currentTeamIndex: 0 };
    }

    case 'goto': {
      const index = Math.min(Math.max(action.index, 0), Math.max(state.teamOrder.length - 1, 0));
      return { ...state, currentTeamIndex: index };
    }

    case 'reset':
      return createSession(1, []);

    default:
      return state;
  }
}

/* -------------------------------- контекст ---------------------------------- */

export interface SessionContextValue {
  state: SessionState;
  dispatch: Dispatch<SessionAction>;
  /** id команды, чей экран открыт */
  activeTeamId: TeamId | null;
  /** решение за указанный раунд уже принято? */
  hasRoundDecision: (teamId: TeamId, round: number) => boolean;
  entries: { teamId: TeamId; progress: TeamProgress }[];
  restart: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function loadState(): SessionState {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionState;
      if (parsed?.version === STATE_VERSION && Array.isArray(parsed.teamOrder) && parsed.teams) return parsed;
    }
  } catch {
    /* ignore */
  }
  return createSession(1, []);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, loadState);

  useEffect(() => {
    try {
      localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const activeTeamId = state.teamOrder[state.currentTeamIndex] ?? null;

  const hasRoundDecision = useCallback(
    (teamId: TeamId, round: number) => {
      const team = state.teams[teamId];
      if (!team) return false;
      return team.decisions.length >= round;
    },
    [state.teams],
  );

  const entries = useMemo(
    () =>
      state.teamOrder
        .map((teamId) => ({ teamId, progress: state.teams[teamId] }))
        .filter((e) => e.progress),
    [state.teamOrder, state.teams],
  );

  const restart = useCallback(() => dispatch({ type: 'reset' }), []);

  const value = useMemo<SessionContextValue>(
    () => ({ state, dispatch, activeTeamId, hasRoundDecision, entries, restart }),
    [state, activeTeamId, hasRoundDecision, entries, restart],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession должен использоваться внутри SessionProvider');
  return ctx;
}

export { PROJECT_IDS };
