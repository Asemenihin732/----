import { motion } from 'framer-motion';
import type { Card } from '../game/types';
import { accentFor } from '../data/theme';
import { categoryEmoji } from '../data/labels';

interface Props {
  cards: Card[];
  accent: string;
  onPick: (cardId: string) => void;
}

export function CardGrid({ cards, accent, onPick }: Props) {
  const theme = accentFor(accent);
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card, i) => (
        <motion.button
          key={card.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onPick(card.id)}
          className={`relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border bg-gradient-to-br ${theme.border} ${theme.gradient} bg-card shadow-lg shadow-black/20`}
        >
          <span className="absolute inset-2 rounded-xl border border-line" />
          <span className="text-3xl opacity-70">🎴</span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-faint">Карта проблемы</span>
        </motion.button>
      ))}
    </div>
  );
}

export function CardBack({ accent }: { accent: string }) {
  const theme = accentFor(accent);
  return (
    <div className={`flex h-24 items-center justify-center rounded-2xl border bg-card ${theme.border}`}>
      <span className="text-2xl">{categoryEmoji.UNIVERSAL}</span>
    </div>
  );
}
