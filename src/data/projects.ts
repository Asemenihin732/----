/**
 * Планы шести проектов игры (методичка, раздел 6).
 * Все проекты рассчитаны на 6 дней — дата Х общая.
 */

export type TeamId =
  | 'catering'
  | 'stage'
  | 'entertainment'
  | 'merch'
  | 'logistics'
  | 'afterparty';

export type WorkNote =
  | 'веха'
  | 'критический путь'
  | 'точка невозврата'
  | 'внешняя зависимость'
  | 'дефицитный ресурс'
  | '';

export interface WorkItem {
  period: string;
  task: string;
  note?: WorkNote;
}

export interface BudgetItem {
  item: string;
  calc: string;
  cost: number;
}

export interface Project {
  id: TeamId;
  number: number;
  name: string;
  shortName: string;
  /** Эмодзи команды для интерфейса */
  emoji: string;
  /** Имя акцента Tailwind (orange/blue/…) */
  accent: string;
  feature: string;
  baseIncome: number;
  baseCost: number;
  baseMargin: number;
  baseMarginPct: number;
  baseDurationDays: number;
  works: WorkItem[];
  budget: BudgetItem[];
}

const make = (p: Omit<Project, 'baseMargin' | 'baseMarginPct'>): Project => ({
  ...p,
  baseMargin: p.baseIncome - p.baseCost,
  baseMarginPct: +(((p.baseIncome - p.baseCost) / p.baseIncome) * 100).toFixed(1),
});

export const PROJECTS: Project[] = [
  make({
    id: 'catering',
    number: 1,
    name: 'Кейтеринг и фуршет',
    shortName: 'Кейтеринг',
    emoji: '🍽️',
    accent: 'orange',
    feature:
      'Скоропортящиеся продукты и жёсткая зависимость от числа гостей: ошибку в объёме исправить нечем.',
    baseIncome: 1_200_000,
    baseCost: 900_000,
    baseDurationDays: 6,
    works: [
      { period: 'День 1', task: 'Утверждение меню с заказчиком', note: 'веха' },
      { period: 'День 1–2', task: 'Дегустация и корректировка меню' },
      { period: 'День 2–3', task: 'Закупка продуктов', note: 'точка невозврата' },
      { period: 'День 3–4', task: 'Аренда и доставка оборудования' },
      { period: 'День 4–5', task: 'Подготовка блюд' },
      { period: 'День 5', task: 'Монтаж фуршетной зоны' },
      { period: 'День 6', task: 'Обслуживание мероприятия и уборка', note: 'веха' },
    ],
    budget: [
      { item: 'Шеф-повар', calc: '18 000 ₽ × 6 дн.', cost: 108_000 },
      { item: 'Повар', calc: '12 000 ₽ × 5 дн.', cost: 60_000 },
      { item: 'Менеджер проекта', calc: '15 000 ₽ × 6 дн.', cost: 90_000 },
      { item: 'Официанты (подряд)', calc: 'бригада', cost: 60_000 },
      { item: 'Продукты', calc: '—', cost: 380_000 },
      { item: 'Аренда оборудования', calc: '—', cost: 202_000 },
    ],
  }),
  make({
    id: 'stage',
    number: 2,
    name: 'Сцена и техническое оснащение',
    shortName: 'Сцена',
    emoji: '🎤',
    accent: 'blue',
    feature:
      'Самый длинный монтаж из всех проектов: критический путь идёт через аренду и доставку техники.',
    baseIncome: 1_250_000,
    baseCost: 950_000,
    baseDurationDays: 6,
    works: [
      { period: 'День 1', task: 'Техническое задание', note: 'веха' },
      { period: 'День 1–2', task: 'Подбор и бронирование оборудования' },
      { period: 'День 2–3', task: 'Логистика и доставка', note: 'критический путь' },
      { period: 'День 3–4', task: 'Монтаж сценического комплекса' },
      { period: 'День 4', task: 'Настройка звука и света' },
      { period: 'День 5', task: 'Технический прогон', note: 'веха' },
      { period: 'День 6', task: 'Мероприятие и демонтаж', note: 'веха' },
    ],
    budget: [
      { item: 'Технический директор', calc: '18 000 ₽ × 6 дн.', cost: 108_000 },
      { item: 'Звукорежиссёр', calc: '15 000 ₽ × 4 дн.', cost: 60_000 },
      { item: 'Монтажники (подряд)', calc: 'бригада', cost: 150_000 },
      { item: 'Аренда оборудования', calc: '—', cost: 480_000 },
      { item: 'Логистика', calc: '—', cost: 82_000 },
      { item: 'Расходные материалы', calc: '—', cost: 70_000 },
    ],
  }),
  make({
    id: 'entertainment',
    number: 3,
    name: 'Развлекательная и нетворкинг-зона',
    shortName: 'Развлечения',
    emoji: '🎉',
    accent: 'purple',
    feature:
      'Много мелких подрядчиков и творческая неопределённость: результат трудно измерить до самого Дня Х.',
    baseIncome: 1_150_000,
    baseCost: 851_000,
    baseDurationDays: 6,
    works: [
      { period: 'День 1', task: 'Концепция активностей', note: 'веха' },
      { period: 'День 1–2', task: 'Подбор ведущих и артистов' },
      { period: 'День 2–3', task: 'Закупка реквизита' },
      { period: 'День 3–5', task: 'Застройка зоны', note: 'критический путь' },
      { period: 'День 5', task: 'Тестовый прогон активностей', note: 'веха' },
      { period: 'День 6', task: 'Проведение', note: 'веха' },
    ],
    budget: [
      { item: 'Креативный продюсер', calc: '16 000 ₽ × 6 дн.', cost: 96_000 },
      { item: 'Ведущий', calc: '40 000 ₽ × 2 дн.', cost: 80_000 },
      { item: 'Координатор', calc: '12 000 ₽ × 6 дн.', cost: 72_000 },
      { item: 'Реквизит', calc: '—', cost: 260_000 },
      { item: 'Застройка (подряд)', calc: '—', cost: 300_000 },
      { item: 'Прочие расходы', calc: '—', cost: 43_000 },
    ],
  }),
  make({
    id: 'merch',
    number: 4,
    name: 'Мерч и брендирование',
    shortName: 'Мерч',
    emoji: '👕',
    accent: 'red',
    feature:
      'Печать тиража — точка невозврата. После неё любое изменение стоит как весь тираж заново.',
    baseIncome: 1_200_000,
    baseCost: 900_000,
    baseDurationDays: 6,
    works: [
      { period: 'День 1', task: 'Дизайн-макеты' },
      { period: 'День 2', task: 'Согласование макетов с заказчиком', note: 'веха' },
      { period: 'День 2–4', task: 'Печать тиража', note: 'точка невозврата' },
      { period: 'День 4', task: 'Контроль качества', note: 'веха' },
      { period: 'День 5', task: 'Упаковка и комплектация' },
      { period: 'День 5–6', task: 'Логистика на площадку' },
      { period: 'День 6', task: 'Раздача участникам', note: 'веха' },
    ],
    budget: [
      { item: 'Дизайнер', calc: '14 000 ₽ × 5 дн.', cost: 70_000 },
      { item: 'Менеджер проекта', calc: '15 000 ₽ × 6 дн.', cost: 90_000 },
      { item: 'Контроль качества', calc: '8 000 ₽ × 3 дн.', cost: 24_000 },
      { item: 'Печать тиража', calc: '—', cost: 520_000 },
      { item: 'Упаковка', calc: '—', cost: 136_000 },
      { item: 'Логистика', calc: '—', cost: 60_000 },
    ],
  }),
  make({
    id: 'logistics',
    number: 5,
    name: 'Трансфер и логистика гостей',
    shortName: 'Логистика',
    emoji: '🚌',
    accent: 'green',
    feature:
      'Проект зависит от чужих данных: списки гостей приходят поздно, а планировать надо заранее.',
    baseIncome: 1_180_000,
    baseCost: 885_000,
    baseDurationDays: 6,
    works: [
      { period: 'День 1–2', task: 'Сбор списков гостей', note: 'внешняя зависимость' },
      { period: 'День 2', task: 'Маршруты и расписание', note: 'веха' },
      { period: 'День 2–3', task: 'Договор с перевозчиком' },
      { period: 'День 3–4', task: 'Бронирование трансферов' },
      { period: 'День 5', task: 'Диспетчерская подготовка и тест', note: 'веха' },
      { period: 'День 6', task: 'Координация в День Х', note: 'веха' },
    ],
    budget: [
      { item: 'Логист', calc: '14 000 ₽ × 6 дн.', cost: 84_000 },
      { item: 'Координатор', calc: '12 000 ₽ × 6 дн.', cost: 72_000 },
      { item: 'Диспетчерская', calc: '9 000 ₽ × 6 дн.', cost: 54_000 },
      { item: 'Перевозчик (подряд)', calc: '—', cost: 520_000 },
      { item: 'Резервные такси', calc: '—', cost: 90_000 },
      { item: 'Прочие расходы', calc: '—', cost: 65_000 },
    ],
  }),
  make({
    id: 'afterparty',
    number: 6,
    name: 'Афтепати',
    shortName: 'Афтепати',
    emoji: '🪩',
    accent: 'yellow',
    feature:
      'Дефицитные ресурсы и разрешительные документы: артистов и лицензию нельзя достать быстрее за деньги.',
    baseIncome: 1_220_000,
    baseCost: 915_000,
    baseDurationDays: 6,
    works: [
      { period: 'День 1', task: 'Подбор и бронирование площадки', note: 'веха' },
      { period: 'День 1–2', task: 'Согласование программы' },
      { period: 'День 2–3', task: 'Артисты и диджей', note: 'дефицитный ресурс' },
      { period: 'День 3–4', task: 'Оформление лицензий и разрешений', note: 'внешняя зависимость' },
      { period: 'День 4–5', task: 'Декор, свет, звук' },
      { period: 'День 6', task: 'Проведение и закрытие площадки', note: 'веха' },
    ],
    budget: [
      { item: 'Продюсер', calc: '16 000 ₽ × 6 дн.', cost: 96_000 },
      { item: 'Диджей', calc: '45 000 ₽ × 2 дн.', cost: 90_000 },
      { item: 'Аренда площадки', calc: '—', cost: 340_000 },
      { item: 'Бар и кейтеринг', calc: '—', cost: 240_000 },
      { item: 'Свет и декор', calc: '—', cost: 105_000 },
      { item: 'Охрана', calc: '—', cost: 44_000 },
    ],
  }),
];

export const PROJECT_IDS: TeamId[] = PROJECTS.map((p) => p.id);

const byId = new Map(PROJECTS.map((p) => [p.id, p]));

export function getProject(id: TeamId): Project {
  const p = byId.get(id);
  if (!p) throw new Error(`Неизвестный проект: ${id}`);
  return p;
}

export function projectLabel(id: TeamId): string {
  return `${getProject(id).number}. ${getProject(id).shortName}`;
}

/** Цвет команды для аватаров и чипов (палитра дизайн-системы) */
/** Цвет команды для аватаров и чипов (палитра X-Lance) */
export const TEAM_COLORS: Record<TeamId, string> = {
  catering: '#8E4300',
  stage: '#0074CA',
  entertainment: '#11813C',
  merch: '#CC2827',
  logistics: '#49C8F3',
  afterparty: '#6270D0',
};
