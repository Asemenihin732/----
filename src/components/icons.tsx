/**
 * Минималистичные SVG-иконки (линейные, 24×24, stroke = currentColor) —
 * вместо эмодзи у команд и категорий карточек. Размер задаётся className (по умолчанию 16px).
 */
import type { ReactNode } from 'react';
import type { CardCategory } from '../game/types';
import type { TeamId } from '../data/projects';

interface IconProps {
  className?: string;
}

function Svg({ className = 'h-4 w-4', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

/* ---------------------------------- команды ---------------------------------- */

const PROJECT_PATHS: Record<TeamId, ReactNode> = {
  // кейтеринг — вилка и нож
  catering: (
    <>
      <path d="M7 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M9 13v8M17 21V3c-2 1.5-3 4-3 7v3h3" />
    </>
  ),
  // сцена — микрофон
  stage: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </>
  ),
  // развлечения — искры
  entertainment: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M19 16v4M17 18h4" />
    </>
  ),
  // мерч — футболка
  merch: <path d="M8 4 4 6.5l1.5 4L7 10v10h10V10l1.5.5 1.5-4L16 4a4 4 0 0 1-8 0Z" />,
  // логистика — грузовик
  logistics: (
    <>
      <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  // афтепати — нота
  afterparty: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
};

export function ProjectIcon({ id, className }: IconProps & { id: TeamId }) {
  return <Svg className={className}>{PROJECT_PATHS[id]}</Svg>;
}

/* ----------------------------- категории карточек ---------------------------- */

const CATEGORY_PATHS: Record<CardCategory, ReactNode> = {
  // люди
  LUDI: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
    </>
  ),
  // подрядчики — документ
  PODRYADCHIKI: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h7M9 16h5" />
    </>
  ),
  // заказчик — рупор
  ZAKAZCHIK: (
    <>
      <path d="M3 10v4h4l8 5V5L7 10H3Z" />
      <path d="M19 9a4 4 0 0 1 0 6" />
    </>
  ),
  // форс-мажор — молния
  FORS_MAJOR: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  // ресурсы — коробка
  RESURSY: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  // универсальная — круговые стрелки
  UNIVERSAL: (
    <>
      <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </>
  ),
  // бонус — подарок
  BONUS: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 4s0 4 4 4ZM12 8s1.5-5 4-4 0 4-4 4Z" />
    </>
  ),
};

export function CategoryIcon({ category, className }: IconProps & { category: CardCategory }) {
  return <Svg className={className}>{CATEGORY_PATHS[category]}</Svg>;
}

/* ------------------------------------ прочее ----------------------------------- */

export function IconMute({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 9v6h4l5 4V5L8 9H4ZM17 9l5 6M22 9l-5 6" />
    </Svg>
  );
}

export function IconPlay({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 4.5v15L19 12 7 4.5Z" />
    </Svg>
  );
}

export function IconPause({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 5v14M16 5v14" />
    </Svg>
  );
}
