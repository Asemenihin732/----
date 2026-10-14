import { useGameStore } from './store/gameStore'
import { IntroScreen } from './components/IntroScreen'
import { TeamTurnScreen } from './components/TeamTurnScreen'
import { RoundDashboardScreen } from './components/RoundDashboardScreen'
import { FinalResultsScreen } from './components/FinalResultsScreen'

function App() {
  const phase = useGameStore((s) => s.phase)

  switch (phase) {
    case 'intro':
      return <IntroScreen />
    case 'team-turn':
      return <TeamTurnScreen />
    case 'round-dashboard':
      return <RoundDashboardScreen />
    case 'final-results':
      return <FinalResultsScreen />
    default:
      return null
  }
}

export default App
