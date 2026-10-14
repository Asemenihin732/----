import { motion, AnimatePresence } from 'framer-motion';
import type { Card, Variant } from '../game/types';
import { accentFor } from '../data/theme';
import { categoryEmoji, categoryLabels } from '../data/labels';
import { formatSignedDays, formatSignedPct, formatSignedRub } from '../game/engine';

interface Props {
  card: Card;
  accent: string;
  onChoose: (variant: Variant) => void;
}

export function CardDetail({ card, accent, onChoose }: Props) {
  const theme = accentFor(accent);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={card.id}
        initial={{ opacity: 0, rotateY: -90 }}
        animate={{ opacity: 1, rotateY: 0 }}
        exit={{ opacity: 0, rotateY: 90 }}
        transition={{ duration: 0.35 }}
        className={`rounded-2xl border bg-card p-6 ${theme.border}`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">{categoryEmoji[card.category]}</span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${theme.text}`}>
            {categoryLabels[card.category]}
          </span>
        </div>
        <h3 className="mb-2 text-2xl font-bold text-strong">{card.title}</h3>
        <p className="mb-5 italic text-muted">{card.flavor}</p>

        <div className="space-y-3">
          {card.variants.map((variant) => (
            <button
              key={variant.key}
              onClick={() => onChoose(variant)}
              className="flex w-full items-start gap-3 rounded-xl border border-line bg-soft px-4 py-3 text-left transition hover:border-brand/50 hover:bg-soft2"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${theme.bg}`}
              >
                {variant.key}
              </span>
              <span className="flex-1">
                <span className="block font-medium text-strong">
                  {variant.label}
                  {variant.isChangeRequest && (
                    <span className="ml-2 rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-500">
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
                  <ul className="mt-2 space-y-0.5 text-xs text-muted">
                    {variant.xlanceSteps.map((step, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-faint">→</span>
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
          <p className="mt-4 text-[11px] text-faint">X-Lance: {card.variants[0].xlanceAction}</p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function Chip({ children, negative }: { children: React.ReactNode; negative: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 ${
        negative ? 'bg-red-500/15 text-red-500' : 'bg-emerald-500/15 text-emerald-600'
      }`}
    >
      {children}
    </span>
  );
}
