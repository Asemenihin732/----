import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { projects } from '../data/projects'

export function IntroScreen() {
  const startGame = useGameStore((s) => s.startGame)
  const [teamCount, setTeamCount] = useState(6)
  const [rounds, setRounds] = useState(3)

  const selectedProjects = projects.slice(0, teamCount)

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="max-w-2xl text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-400 mb-3">X-Lance</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
          «Спаси конференцию!»
        </h1>
        <p className="text-white/60 mb-8">
          Команды ведут проекты конференции PMFest 2026. У каждой — свой план, свой бюджет и своя
          колода проблем. Побеждает команда с наибольшим итоговым индексом проекта: срок,
          маржинальность и удовлетворённость заказчика в равных долях.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40 mb-2">Команды</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setTeamCount(n)}
                  className={`w-9 h-9 rounded-full text-sm font-semibold transition ${
                    n === teamCount
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40 mb-2">Раунды</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setRounds(n)}
                  className={`w-9 h-9 rounded-full text-sm font-semibold transition ${
                    n === rounds
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-white/30 mb-8">
          В игре примут участие: {selectedProjects.map((p) => `${p.emoji} ${p.name}`).join(', ')}
        </p>

        <button
          onClick={() => startGame(teamCount, rounds)}
          className="rounded-full bg-indigo-500 hover:bg-indigo-400 transition px-8 py-3 text-white font-semibold shadow-lg shadow-indigo-500/30"
        >
          Начать игру
        </button>
      </div>
    </div>
  )
}
