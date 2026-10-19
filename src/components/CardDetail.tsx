import { motion, AnimatePresence } from 'framer-motion';
import type { Card, Variant } from '../game/types';
import { accentFor } from '../data/theme';
import { categoryEmoji, categoryLabels } from '../data/labels';
import { formatMoney, formatSignedDays, formatSignedPct, formatSignedRub } from '../game/engine';

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
        className={`flex flex-col rounded-2xl border bg-card p-5 lg:min-h-0 lg:flex-1 ${theme.border}`}
      >
        {/* шапка: категория и заголовок в одну строку, ниже — описание */}
        <div className="shrink-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-2">
              <span className="text-lg">{categoryEmoji[card.category]}</span>
              <span className={`text-caption font-semibold uppercase tracking-wide ${theme.text}`}>
                {categoryLabels[card.category]}
              </span>
            </span>
            <h3 data-testid="card-title" className="text-xl font-bold text-strong">{card.title}</h3>
          </div>
          <p className="mt-1 italic text-muted">{card.flavor}</p>
        </div>

        {/* варианты: на широких экранах — колонками рядом на всю оставшуюся высоту */}
        <div className="mt-4 grid grid-cols-1 gap-3 lg:min-h-[var(--ui-cards-min-height)] lg:flex-1 lg:auto-cols-fr lg:grid-flow-col">
          {card.variants.map((variant, i) => (
            <motion.button
              key={variant.key}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.08 }}
              data-testid={`variant-${variant.key}`}
              onClick={() => onChoose(variant)}
              className="flex flex-col items-start gap-2 rounded-xl border border-line bg-soft p-4 text-left transition-colors hover:border-brand/50 hover:bg-soft2 lg:overflow-y-auto"
            >
              <span className="flex items-start gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${theme.bg}`}
                >
                  {variant.key}
                </span>
                <span className="font-semibold text-strong">{variant.label}</span>
              </span>
              {variant.isChangeRequest && (
                <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-caption uppercase tracking-wide text-emerald-500">
                  запрос на изменение
                </span>
              )}
              {variant.xlanceSteps && (
                <ul className="space-y-0.5 pt-1 text-sm text-muted">
                  {variant.xlanceSteps.map((step, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-faint">→</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              )}
              {/* подпись снизу: что решение даёт в игре */}
              <span data-testid={`consequences-${variant.key}`} className="mt-auto w-full border-t border-line pt-2">
                <span className="mb-1 block text-caption uppercase tracking-wide text-faint">Последствия в игре</span>
                <span className="flex flex-wrap gap-2 text-sm">
                  {variant.deltaDays ? (
                    <Chip negative={variant.deltaDays > 0}>{formatSignedDays(variant.deltaDays)} к сроку</Chip>
                  ) : null}
                  {variant.deltaCost ? (
                    <Chip negative={variant.deltaCost > 0}>
                      {formatSignedRub(variant.deltaCost)} расход
                      {variant.laborCost ? ` (в т. ч. труд ${formatMoney(variant.laborCost)})` : ''}
                    </Chip>
                  ) : null}
                  {variant.deltaRevenue ? (
                    <Chip negative={false}>{formatSignedRub(variant.deltaRevenue)} доход</Chip>
                  ) : null}
                  {variant.deltaSatisfaction ? (
                    <Chip negative={variant.deltaSatisfaction < 0}>
                      {formatSignedPct(variant.deltaSatisfaction)} удовлетворённости
                    </Chip>
                  ) : null}
                  {!variant.deltaDays &&
                  !variant.deltaCost &&
                  !variant.deltaRevenue &&
                  !variant.deltaSatisfaction ? (
                    <Chip negative={false}>без последствий</Chip>
                  ) : null}
                </span>
              </span>
            </motion.button>
          ))}
        </div>

        {!card.variants[0].xlanceSteps && (
          <p className="mt-3 shrink-0 text-caption text-faint">X-Lance: {card.variants[0].xlanceAction}</p>
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
