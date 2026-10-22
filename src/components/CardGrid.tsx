import { motion } from 'framer-motion';
import { accentFor } from '../data/theme';
import { categoryEmoji } from '../data/labels';

interface Props {
  /** Сколько закрытых карт выложить (содержимое не важно — откроется карточка колоды) */
  count?: number;
  accent: string;
  /** Выбрана закрытая карта с этим номером */
  onPick: (backId: string) => void;
}

export function CardGrid({ count = 4, accent, onPick }: Props) {
  const backs = Array.from({ length: count }, (_, i) => `back-${i + 1}`);
  const theme = accentFor(accent);
  return (
    // На широких экранах ряд карт занимает всю доступную высоту, ширина карты — по пропорции.
    <div className="grid grid-cols-2 gap-4 pt-1 sm:grid-cols-4 lg:min-h-[var(--ui-cards-min-height)] lg:flex-1 lg:grid-rows-[minmax(0,1fr)]">
      {backs.map((backId, i) => (
        <motion.button
          key={backId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.97 }}
          data-testid="card-back"
          onClick={() => onPick(backId)}
          className={`relative flex aspect-[var(--ui-card-ratio)] w-full max-h-[var(--ui-cards-max-height)] max-w-[calc(var(--ui-cards-max-height)*var(--ui-card-ratio))] justify-self-center cursor-pointer lg:h-full lg:w-auto lg:max-w-full lg:justify-self-center flex-col items-center justify-center gap-2 rounded-2xl border bg-gradient-to-br ${theme.border} ${theme.gradient} bg-card shadow-lg shadow-black/20`}
        >
          <span className="absolute inset-2 rounded-xl border border-line" />
          <span className="text-3xl opacity-70">{i+1}</span>
          <span className="text-caption uppercase tracking-[0.4em] text-faint">Карта проблемы</span>
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
