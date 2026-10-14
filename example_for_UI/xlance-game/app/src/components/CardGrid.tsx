import { motion } from 'framer-motion'
import type { Card } from '../types/game'
import { accentFor } from '../data/theme'
import { categoryEmoji } from '../data/labels'

interface Props {
  cards: Card[]
  accent: string
  onPick: (cardId: string) => void
}

export function CardGrid({ cards, accent, onPick }: Props) {
  const theme = accentFor(accent)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.button
          key={card.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onPick(card.id)}
          className={`relative aspect-[3/4] rounded-2xl border ${theme.border} bg-gradient-to-br ${theme.gradient} bg-[#171933] flex flex-col items-center justify-center gap-2 shadow-lg shadow-black/30 cursor-pointer`}
        >
          <div className="absolute inset-2 rounded-xl border border-white/10" />
          <span className="text-3xl opacity-70">🎴</span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/40">
            Карта проблемы
          </span>
        </motion.button>
      ))}
    </div>
  )
}

export function CardBack({ accent }: { accent: string }) {
  const theme = accentFor(accent)
  return (
    <div
      className={`rounded-2xl border ${theme.border} bg-[#171933] flex items-center justify-center h-24`}
    >
      <span className="text-2xl">{categoryEmoji.UNIVERSAL}</span>
    </div>
  )
}
