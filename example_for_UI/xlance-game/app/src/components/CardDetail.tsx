import { motion, AnimatePresence } from 'framer-motion'
import type { Card, Variant } from '../types/game'
import { accentFor } from '../data/theme'
import { categoryEmoji, categoryLabels } from '../data/labels'
import { formatSignedDays, formatSignedPct, formatSignedRub } from '../store/kpi'

interface Props {
  card: Card
  accent: string
  onChoose: (variant: Variant) => void
}

export function CardDetail({ card, accent, onChoose }: Props) {
  const theme = accentFor(accent)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={card.id}
        initial={{ opacity: 0, rotateY: -90 }}
        animate={{ opacity: 1, rotateY: 0 }}
        exit={{ opacity: 0, rotateY: 90 }}
        transition={{ duration: 0.35 }}
        className={`rounded-2xl border ${theme.border} bg-[#171933] p-6`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{categoryEmoji[card.category]}</span>
          <span className={`text-xs uppercase tracking-wide font-semibold ${theme.text}`}>
            {categoryLabels[card.category]}
          </span>
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">{card.title}</h3>
        <p className="text-white/60 italic mb-5">{card.flavor}</p>

        <div className="space-y-3">
          {card.variants.map((variant) => (
            <button
              key={variant.key}
              onClick={() => onChoose(variant)}
              className={`w-full text-left rounded-xl border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 transition px-4 py-3 flex items-start gap-3`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full ${theme.bg} text-white text-sm font-bold flex items-center justify-center`}
              >
                {variant.key}
              </span>
              <span className="flex-1">
                <span className="block text-white font-medium">
                  {variant.label}
                  {variant.isChangeRequest && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-400 border border-emerald-500/40 rounded-full px-2 py-0.5">
                      запрос на изменение
                    </span>
                  )}
                </span>
                <span className="mt-1 flex flex-wrap gap-2 text-xs">
                  {variant.deltaDays ? (
                    <Chip negative={variant.deltaDays > 0}>{formatSignedDays(variant.deltaDays)} к сроку</Chip>
                  ) : null}
                  {variant.deltaCost ? (
                    <Chip negative={variant.deltaCost > 0}>{formatSignedRub(variant.deltaCost)} расход</Chip>
                  ) : null}
                  {variant.deltaRevenue ? (
                    <Chip negative={false}>{formatSignedRub(variant.deltaRevenue)} доход</Chip>
                  ) : null}
                  {variant.deltaSatisfaction ? (
                    <Chip negative={variant.deltaSatisfaction < 0}>
                      {formatSignedPct(variant.deltaSatisfaction)} удовл.
                    </Chip>
                  ) : null}
                  {!variant.deltaDays &&
                  !variant.deltaCost &&
                  !variant.deltaRevenue &&
                  !variant.deltaSatisfaction ? (
                    <Chip negative={false}>без последствий</Chip>
                  ) : null}
                </span>
                {variant.xlanceSteps && (
                  <ul className="mt-2 space-y-0.5 text-xs text-white/50">
                    {variant.xlanceSteps.map((step, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-white/30">→</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            </button>
          ))}
        </div>

        {!card.variants[0].xlanceSteps && (
          <p className="mt-4 text-[11px] text-white/30">X-Lance: {card.variants[0].xlanceAction}</p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function Chip({ children, negative }: { children: React.ReactNode; negative: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 ${negative ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}
    >
      {children}
    </span>
  )
}
