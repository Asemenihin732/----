/**
 * Разбор плановых данных проектов (методичка, раздел 6):
 * периоды работ вида «День 1–2» и строки расчёта бюджета
 * вида «18 000 ₽ × 6 дн.».
 */

/** «День 1–2» → { start: 1, end: 2 }; «День 6» → { start: 6, end: 6 } */
export function parseDayRange(period: string): { start: number; end: number } {
  const days = (period.match(/\d+/g) ?? [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (days.length === 0) return { start: 1, end: 1 };
  return { start: Math.min(...days), end: Math.max(...days) };
}

/** «18 000 ₽ × 6 дн.» → { rate: 18000, days: 6 }; «бригада»/«—» → пусто */
export function parseBudgetCalc(calc: string): { rate: number | null; days: number | null } {
  if (!calc.includes('×')) return { rate: null, days: null };
  const nums = (calc.match(/[\d\s]+/g) ?? [])
    .map((s) => Number(s.replace(/\s/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  return { rate: nums[0] ?? null, days: nums[1] ?? null };
}
