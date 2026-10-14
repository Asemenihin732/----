import type { CardCategory } from '../game/types'

export const categoryLabels: Record<CardCategory, string> = {
  LUDI: 'Люди',
  PODRYADCHIKI: 'Подрядчики',
  ZAKAZCHIK: 'Заказчик',
  FORS_MAJOR: 'Форс-мажор',
  RESURSY: 'Ресурсы',
  UNIVERSAL: 'Универсальная',
  BONUS: 'Бонус',
}

export const categoryEmoji: Record<CardCategory, string> = {
  LUDI: '🧑‍🍳',
  PODRYADCHIKI: '🧾',
  ZAKAZCHIK: '📣',
  FORS_MAJOR: '⚡',
  RESURSY: '📦',
  UNIVERSAL: '🔁',
  BONUS: '🎁',
}
