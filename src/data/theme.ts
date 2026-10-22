export interface AccentTheme {
  bg: string
  bgSoft: string
  border: string
  text: string
  ring: string
  gradient: string
}

// NOTE: written as full literal class strings (not template-built) so the
// Tailwind scanner can find them.
export const accentThemes: Record<string, AccentTheme> = {
  orange: {
    bg: 'bg-orange-500',
    bgSoft: 'bg-orange-500/15',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    ring: 'ring-orange-500/60',
    gradient: 'from-orange-500/25 to-orange-500/0',
  },
  blue: {
    bg: 'bg-blue-500',
    bgSoft: 'bg-blue-500/15',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    ring: 'ring-blue-500/60',
    gradient: 'from-blue-500/25 to-blue-500/0',
  },
  purple: {
    bg: 'bg-purple-500',
    bgSoft: 'bg-purple-500/15',
    border: 'border-purple-500/50',
    text: 'text-purple-400',
    ring: 'ring-purple-500/60',
    gradient: 'from-purple-500/25 to-purple-500/0',
  },
  red: {
    bg: 'bg-red-500',
    bgSoft: 'bg-red-500/15',
    border: 'border-red-500/50',
    text: 'text-red-400',
    ring: 'ring-red-500/60',
    gradient: 'from-red-500/25 to-red-500/0',
  },
  green: {
    bg: 'bg-emerald-500',
    bgSoft: 'bg-emerald-500/15',
    border: 'border-emerald-500/50',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/60',
    gradient: 'from-emerald-500/25 to-emerald-500/0',
  },
  yellow: {
    bg: 'bg-amber-500',
    bgSoft: 'bg-amber-500/15',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    ring: 'ring-amber-500/60',
    gradient: 'from-amber-500/25 to-amber-500/0',
  },
}

/** Единый акцент в стиле X-Lance (Primary 500 / Accent light) — для всех команд. */
const xlanceTheme: AccentTheme = {
  bg: 'bg-brand',
  bgSoft: 'bg-brand/10',
  border: 'border-brand/40',
  text: 'text-brand',
  ring: 'ring-brand/50',
  gradient: 'from-brand/15 to-brand/0',
}

// Цветные акценты команд (accentThemes) больше не используются в интерфейсе:
// игра оформлена в фирменных цветах X-Lance.
export function accentFor(_accent: string): AccentTheme {
  return xlanceTheme
}
