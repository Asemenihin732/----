/**
 * Базовые планы работ из файла «X-Lance_Plany_rabot.xlsx» (по листу на команду).
 *
 * Для каждой задачи указаны: длительность, трудозатраты (чел.-дн. по каждому
 * ресурсу), предшественники (номер задачи + тип связи + лаг) и стоимость труда.
 * Отдельно — таблица ресурсов проекта: ставка в день для трудовых ресурсов
 * и разовые суммы для отдельных расходов.
 *
 * По этим данным разворачиваются задачи и ресурсы в X-Lance: работы становятся
 * самостоятельными задачами проекта (без родителя), связи — предшественниками,
 * а трудозатраты — назначениями ресурсов.
 */
import type { TeamId } from './projects';

/** Тип связи предшествования: FS — финиш→старт, SS — старт→старт и т. д. */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

/** Назначение ресурса на задачу: ресурс и его трудозатраты в человеко-днях. */
export interface PlannerAssignment {
  resource: string;
  days: number;
}

/** Предшественник задачи: номер по порядку, тип связи и лаг в днях. */
export interface PlannerPredecessor {
  no: number;
  type: DependencyType;
  lag: number;
}

export interface PlannerTask {
  /** Номер задачи в плане (1-based) — на него ссылаются предшественники. */
  no: number;
  name: string;
  /** Длительность, дн. (0 — веха). */
  durationDays: number;
  /** Суммарные трудозатраты, чел.-дн. */
  laborDays: number;
  assignments: PlannerAssignment[];
  predecessors: PlannerPredecessor[];
  /** Стоимость труда, ₽. */
  laborCost: number;
  /** Отдельные расходы задачи (материалы), ₽. */
  expenses: { item: string; amount: number }[];
  note: string;
}

export interface PlannerResource {
  name: string;
  /** HUMAN — трудовой ресурс (со ставкой), EXPENSE — отдельный расход. */
  kind: 'HUMAN' | 'EXPENSE';
  /** Ставка в день, ₽ (только для HUMAN). */
  ratePerDay?: number;
  /** Загрузка, чел.-дн. (только для HUMAN). */
  loadDays?: number;
  /** Плановая стоимость, ₽. */
  cost: number;
}

export interface PlannerSheet {
  teamId: TeamId;
  title: string;
  tasks: PlannerTask[];
  resources: PlannerResource[];
}

export const PLANS: Record<TeamId, PlannerSheet> = {
  catering: {
    teamId: 'catering',
    title: 'Команда 1. Кейтеринг и фуршет',
    tasks: [
      {
        no: 1,
        name: 'Утверждение меню с заказчиком',
        durationDays: 1,
        laborDays: 2,
        assignments: [
          { resource: 'Менеджер проекта', days: 1 },
          { resource: 'Шеф-повар', days: 1 },
        ],
        predecessors: [],
        laborCost: 33000,
        expenses: [],
        note: 'веха',
      },
      {
        no: 2,
        name: 'Дегустация и корректировка меню',
        durationDays: 1,
        laborDays: 3,
        assignments: [
          { resource: 'Шеф-повар', days: 1 },
          { resource: 'Повар', days: 1 },
          { resource: 'Менеджер проекта', days: 1 },
        ],
        predecessors: [{ no: 1, type: 'FS', lag: 0 }],
        laborCost: 45000,
        expenses: [],
        note: '',
      },
      {
        no: 3,
        name: 'Закупка продуктов',
        durationDays: 1,
        laborDays: 2,
        assignments: [
          { resource: 'Шеф-повар', days: 1 },
          { resource: 'Повар', days: 1 },
        ],
        predecessors: [{ no: 2, type: 'FS', lag: 0 }],
        laborCost: 30000,
        expenses: [{ item: 'Продукты', amount: 380000 }],
        note: 'точка невозврата',
      },
      {
        no: 4,
        name: 'Аренда и доставка оборудования',
        durationDays: 2,
        laborDays: 2,
        assignments: [{ resource: 'Менеджер проекта', days: 2 }],
        predecessors: [{ no: 2, type: 'FS', lag: 0 }],
        laborCost: 30000,
        expenses: [{ item: 'Аренда оборудования', amount: 202000 }],
        note: 'резерв 1 день',
      },
      {
        no: 5,
        name: 'Подготовка блюд',
        durationDays: 1,
        laborDays: 2,
        assignments: [
          { resource: 'Шеф-повар', days: 1 },
          { resource: 'Повар', days: 1 },
        ],
        predecessors: [{ no: 3, type: 'FS', lag: 0 }],
        laborCost: 30000,
        expenses: [],
        note: '',
      },
      {
        no: 6,
        name: 'Монтаж фуршетной зоны',
        durationDays: 1,
        laborDays: 3,
        assignments: [
          { resource: 'Шеф-повар', days: 1 },
          { resource: 'Повар', days: 1 },
          { resource: 'Менеджер проекта', days: 1 },
        ],
        predecessors: [
          { no: 4, type: 'FS', lag: 0 },
          { no: 5, type: 'FS', lag: 0 },
        ],
        laborCost: 45000,
        expenses: [],
        note: '',
      },
      {
        no: 7,
        name: 'Обслуживание мероприятия и уборка',
        durationDays: 1,
        laborDays: 3,
        assignments: [
          { resource: 'Шеф-повар', days: 1 },
          { resource: 'Повар', days: 1 },
          { resource: 'Менеджер проекта', days: 1 },
        ],
        predecessors: [{ no: 6, type: 'FS', lag: 0 }],
        laborCost: 45000,
        expenses: [{ item: 'Официанты (подряд)', amount: 60000 }],
        note: 'веха · День Х',
      },
    ],
    resources: [
      { name: 'Шеф-повар', kind: 'HUMAN', ratePerDay: 18000, loadDays: 6, cost: 108000 },
      { name: 'Повар', kind: 'HUMAN', ratePerDay: 12000, loadDays: 5, cost: 60000 },
      { name: 'Менеджер проекта', kind: 'HUMAN', ratePerDay: 15000, loadDays: 6, cost: 90000 },
      { name: 'Официанты (подряд)', kind: 'EXPENSE', cost: 60000 },
      { name: 'Продукты', kind: 'EXPENSE', cost: 380000 },
      { name: 'Аренда оборудования', kind: 'EXPENSE', cost: 202000 },
    ],
  },

  stage: {
    teamId: 'stage',
    title: 'Команда 2. Сцена и техническое оснащение',
    tasks: [
      {
        no: 1,
        name: 'Техническое задание',
        durationDays: 1,
        laborDays: 1,
        assignments: [{ resource: 'Технический директор', days: 1 }],
        predecessors: [],
        laborCost: 18000,
        expenses: [],
        note: 'веха',
      },
      {
        no: 2,
        name: 'Подбор и бронирование оборудования',
        durationDays: 1,
        laborDays: 2,
        assignments: [
          { resource: 'Технический директор', days: 1 },
          { resource: 'Звукорежиссёр', days: 1 },
        ],
        predecessors: [{ no: 1, type: 'FS', lag: 0 }],
        laborCost: 33000,
        expenses: [{ item: 'Аренда оборудования', amount: 480000 }],
        note: '',
      },
      {
        no: 3,
        name: 'Логистика и доставка',
        durationDays: 1,
        laborDays: 1,
        assignments: [{ resource: 'Технический директор', days: 1 }],
        predecessors: [{ no: 2, type: 'FS', lag: 0 }],
        laborCost: 18000,
        expenses: [{ item: 'Логистика', amount: 82000 }],
        note: 'критический путь',
      },
      {
        no: 4,
        name: 'Монтаж сценического комплекса',
        durationDays: 2,
        laborDays: 3,
        assignments: [
          { resource: 'Технический директор', days: 2 },
          { resource: 'Звукорежиссёр', days: 1 },
        ],
        predecessors: [{ no: 3, type: 'FS', lag: 0 }],
        laborCost: 51000,
        expenses: [
          { item: 'Монтажники (подряд)', amount: 150000 },
          { item: 'Расходные материалы', amount: 70000 },
        ],
        note: '',
      },
      {
        no: 5,
        name: 'Настройка звука и света',
        durationDays: 1,
        laborDays: 1,
        assignments: [{ resource: 'Звукорежиссёр', days: 1 }],
        predecessors: [{ no: 4, type: 'SS', lag: 1 }],
        laborCost: 15000,
        expenses: [],
        note: '',
      },
      {
        no: 6,
        name: 'Технический прогон',
        durationDays: 0,
        laborDays: 0,
        assignments: [],
        predecessors: [
          { no: 4, type: 'FS', lag: 0 },
          { no: 5, type: 'FS', lag: 0 },
        ],
        laborCost: 0,
        expenses: [],
        note: 'веха · 0 дней',
      },
      {
        no: 7,
        name: 'Мероприятие и демонтаж',
        durationDays: 1,
        laborDays: 2,
        assignments: [
          { resource: 'Технический директор', days: 1 },
          { resource: 'Звукорежиссёр', days: 1 },
        ],
        predecessors: [{ no: 6, type: 'FS', lag: 0 }],
        laborCost: 33000,
        expenses: [],
        note: 'веха · День Х',
      },
    ],
    resources: [
      { name: 'Технический директор', kind: 'HUMAN', ratePerDay: 18000, loadDays: 6, cost: 108000 },
      { name: 'Звукорежиссёр', kind: 'HUMAN', ratePerDay: 15000, loadDays: 4, cost: 60000 },
      { name: 'Монтажники (подряд)', kind: 'EXPENSE', cost: 150000 },
      { name: 'Аренда оборудования', kind: 'EXPENSE', cost: 480000 },
      { name: 'Логистика', kind: 'EXPENSE', cost: 82000 },
      { name: 'Расходные материалы', kind: 'EXPENSE', cost: 70000 },
    ],
  },

  entertainment: {
    teamId: 'entertainment',
    title: 'Команда 3. Развлекательная и нетворкинг-зона',
    tasks: [
      {
        no: 1,
        name: 'Концепция активностей',
        durationDays: 1,
        laborDays: 2,
        assignments: [
          { resource: 'Креативный продюсер', days: 1 },
          { resource: 'Координатор', days: 1 },
        ],
        predecessors: [],
        laborCost: 28000,
        expenses: [],
        note: 'веха',
      },
      {
        no: 2,
        name: 'Подбор ведущих и артистов',
        durationDays: 1,
        laborDays: 1,
        assignments: [{ resource: 'Креативный продюсер', days: 1 }],
        predecessors: [{ no: 1, type: 'FS', lag: 0 }],
        laborCost: 16000,
        expenses: [],
        note: 'дефицитный ресурс',
      },
      {
        no: 3,
        name: 'Закупка реквизита',
        durationDays: 1,
        laborDays: 1,
        assignments: [{ resource: 'Координатор', days: 1 }],
        predecessors: [{ no: 1, type: 'FS', lag: 0 }],
        laborCost: 12000,
        expenses: [{ item: 'Реквизит', amount: 260000 }],
        note: 'параллельно задаче 2',
      },
      {
        no: 4,
        name: 'Застройка зоны',
        durationDays: 2,
        laborDays: 4,
        assignments: [
          { resource: 'Креативный продюсер', days: 2 },
          { resource: 'Координатор', days: 2 },
        ],
        predecessors: [
          { no: 2, type: 'FS', lag: 0 },
          { no: 3, type: 'FS', lag: 0 },
        ],
        laborCost: 56000,
        expenses: [{ item: 'Застройка (подряд)', amount: 300000 }],
        note: 'критический путь',
      },
      {
        no: 5,
        name: 'Тестовый прогон активностей',
        durationDays: 1,
        laborDays: 3,
        assignments: [
          { resource: 'Креативный продюсер', days: 1 },
          { resource: 'Ведущий', days: 1 },
          { resource: 'Координатор', days: 1 },
        ],
        predecessors: [{ no: 4, type: 'FS', lag: 0 }],
        laborCost: 68000,
        expenses: [],
        note: 'веха',
      },
      {
        no: 6,
        name: 'Проведение',
        durationDays: 1,
        laborDays: 3,
        assignments: [
          { resource: 'Креативный продюсер', days: 1 },
          { resource: 'Ведущий', days: 1 },
          { resource: 'Координатор', days: 1 },
        ],
        predecessors: [{ no: 5, type: 'FS', lag: 0 }],
        laborCost: 68000,
        expenses: [{ item: 'Прочие расходы', amount: 43000 }],
        note: 'веха · День Х',
      },
    ],
    resources: [
      { name: 'Креативный продюсер', kind: 'HUMAN', ratePerDay: 16000, loadDays: 6, cost: 96000 },
      { name: 'Ведущий', kind: 'HUMAN', ratePerDay: 40000, loadDays: 2, cost: 80000 },
      { name: 'Координатор', kind: 'HUMAN', ratePerDay: 12000, loadDays: 6, cost: 72000 },
      { name: 'Реквизит', kind: 'EXPENSE', cost: 260000 },
      { name: 'Застройка (подряд)', kind: 'EXPENSE', cost: 300000 },
      { name: 'Прочие расходы', kind: 'EXPENSE', cost: 43000 },
    ],
  },

  merch: {
    teamId: 'merch',
    title: 'Команда 4. Мерч и брендирование',
    tasks: [
      {
        no: 1,
        name: 'Дизайн-макеты',
        durationDays: 1,
        laborDays: 2,
        assignments: [
          { resource: 'Дизайнер', days: 1 },
          { resource: 'Менеджер проекта', days: 1 },
        ],
        predecessors: [],
        laborCost: 29000,
        expenses: [],
        note: '',
      },
      {
        no: 2,
        name: 'Согласование макетов с заказчиком',
        durationDays: 1,
        laborDays: 2,
        assignments: [
          { resource: 'Дизайнер', days: 1 },
          { resource: 'Менеджер проекта', days: 1 },
        ],
        predecessors: [{ no: 1, type: 'FS', lag: 0 }],
        laborCost: 29000,
        expenses: [],
        note: 'веха',
      },
      {
        no: 3,
        name: 'Печать тиража',
        durationDays: 2,
        laborDays: 6,
        assignments: [
          { resource: 'Дизайнер', days: 2 },
          { resource: 'Менеджер проекта', days: 2 },
          { resource: 'Контроль качества', days: 2 },
        ],
        predecessors: [{ no: 2, type: 'FS', lag: 0 }],
        laborCost: 74000,
        expenses: [{ item: 'Печать тиража', amount: 520000 }],
        note: 'точка невозврата',
      },
      {
        no: 4,
        name: 'Контроль качества',
        durationDays: 0,
        laborDays: 0,
        assignments: [],
        predecessors: [{ no: 3, type: 'FS', lag: 0 }],
        laborCost: 0,
        expenses: [],
        note: 'веха · 0 дней',
      },
      {
        no: 5,
        name: 'Упаковка и комплектация',
        durationDays: 1,
        laborDays: 3,
        assignments: [
          { resource: 'Менеджер проекта', days: 1 },
          { resource: 'Контроль качества', days: 1 },
          { resource: 'Дизайнер', days: 1 },
        ],
        predecessors: [{ no: 4, type: 'FS', lag: 0 }],
        laborCost: 37000,
        expenses: [{ item: 'Упаковка', amount: 136000 }],
        note: '',
      },
      {
        no: 6,
        name: 'Логистика на площадку',
        durationDays: 1,
        laborDays: 1,
        assignments: [{ resource: 'Менеджер проекта', days: 1 }],
        predecessors: [{ no: 5, type: 'FS', lag: 0 }],
        laborCost: 15000,
        expenses: [{ item: 'Логистика', amount: 60000 }],
        note: '',
      },
      {
        no: 7,
        name: 'Раздача участникам',
        durationDays: 0,
        laborDays: 0,
        assignments: [],
        predecessors: [{ no: 6, type: 'FS', lag: 0 }],
        laborCost: 0,
        expenses: [],
        note: 'веха · День Х',
      },
    ],
    resources: [
      { name: 'Дизайнер', kind: 'HUMAN', ratePerDay: 14000, loadDays: 5, cost: 70000 },
      { name: 'Менеджер проекта', kind: 'HUMAN', ratePerDay: 15000, loadDays: 6, cost: 90000 },
      { name: 'Контроль качества', kind: 'HUMAN', ratePerDay: 8000, loadDays: 3, cost: 24000 },
      { name: 'Печать тиража', kind: 'EXPENSE', cost: 520000 },
      { name: 'Упаковка', kind: 'EXPENSE', cost: 136000 },
      { name: 'Логистика', kind: 'EXPENSE', cost: 60000 },
    ],
  },

  logistics: {
    teamId: 'logistics',
    title: 'Команда 5. Трансфер и логистика гостей',
    tasks: [
      {
        no: 1,
        name: 'Сбор списков гостей',
        durationDays: 2,
        laborDays: 6,
        assignments: [
          { resource: 'Логист', days: 2 },
          { resource: 'Координатор', days: 2 },
          { resource: 'Диспетчерская', days: 2 },
        ],
        predecessors: [],
        laborCost: 70000,
        expenses: [],
        note: 'внешняя зависимость',
      },
      {
        no: 2,
        name: 'Маршруты и расписание',
        durationDays: 1,
        laborDays: 3,
        assignments: [
          { resource: 'Логист', days: 1 },
          { resource: 'Координатор', days: 1 },
          { resource: 'Диспетчерская', days: 1 },
        ],
        predecessors: [{ no: 1, type: 'FS', lag: 0 }],
        laborCost: 35000,
        expenses: [],
        note: 'веха',
      },
      {
        no: 3,
        name: 'Договор с перевозчиком',
        durationDays: 1,
        laborDays: 3,
        assignments: [
          { resource: 'Логист', days: 1 },
          { resource: 'Координатор', days: 1 },
          { resource: 'Диспетчерская', days: 1 },
        ],
        predecessors: [{ no: 2, type: 'FS', lag: 0 }],
        laborCost: 35000,
        expenses: [{ item: 'Перевозчик (подряд)', amount: 520000 }],
        note: '',
      },
      {
        no: 4,
        name: 'Бронирование трансферов',
        durationDays: 1,
        laborDays: 2,
        assignments: [
          { resource: 'Логист', days: 1 },
          { resource: 'Координатор', days: 1 },
        ],
        predecessors: [{ no: 3, type: 'FS', lag: 0 }],
        laborCost: 26000,
        expenses: [{ item: 'Резервные такси', amount: 90000 }],
        note: '',
      },
      {
        no: 5,
        name: 'Диспетчерская подготовка и тест',
        durationDays: 1,
        laborDays: 1,
        assignments: [{ resource: 'Диспетчерская', days: 1 }],
        predecessors: [{ no: 3, type: 'FS', lag: 0 }],
        laborCost: 9000,
        expenses: [],
        note: 'веха · параллельно задаче 4',
      },
      {
        no: 6,
        name: 'Координация в День Х',
        durationDays: 1,
        laborDays: 3,
        assignments: [
          { resource: 'Логист', days: 1 },
          { resource: 'Координатор', days: 1 },
          { resource: 'Диспетчерская', days: 1 },
        ],
        predecessors: [
          { no: 4, type: 'FS', lag: 0 },
          { no: 5, type: 'FS', lag: 0 },
        ],
        laborCost: 35000,
        expenses: [{ item: 'Прочие расходы', amount: 65000 }],
        note: 'веха · День Х',
      },
    ],
    resources: [
      { name: 'Логист', kind: 'HUMAN', ratePerDay: 14000, loadDays: 6, cost: 84000 },
      { name: 'Координатор', kind: 'HUMAN', ratePerDay: 12000, loadDays: 6, cost: 72000 },
      { name: 'Диспетчерская', kind: 'HUMAN', ratePerDay: 9000, loadDays: 6, cost: 54000 },
      { name: 'Перевозчик (подряд)', kind: 'EXPENSE', cost: 520000 },
      { name: 'Резервные такси', kind: 'EXPENSE', cost: 90000 },
      { name: 'Прочие расходы', kind: 'EXPENSE', cost: 65000 },
    ],
  },

  afterparty: {
    teamId: 'afterparty',
    title: 'Команда 6. Афтепати',
    tasks: [
      {
        no: 1,
        name: 'Подбор и бронирование площадки',
        durationDays: 1,
        laborDays: 1,
        assignments: [{ resource: 'Продюсер', days: 1 }],
        predecessors: [],
        laborCost: 16000,
        expenses: [{ item: 'Аренда площадки', amount: 340000 }],
        note: 'веха',
      },
      {
        no: 2,
        name: 'Согласование программы',
        durationDays: 1,
        laborDays: 1,
        assignments: [{ resource: 'Продюсер', days: 1 }],
        predecessors: [{ no: 1, type: 'FS', lag: 0 }],
        laborCost: 16000,
        expenses: [],
        note: '',
      },
      {
        no: 3,
        name: 'Артисты и диджей',
        durationDays: 1,
        laborDays: 1,
        assignments: [{ resource: 'Продюсер', days: 1 }],
        predecessors: [{ no: 2, type: 'FS', lag: 0 }],
        laborCost: 16000,
        expenses: [],
        note: 'дефицитный ресурс',
      },
      {
        no: 4,
        name: 'Оформление лицензий и разрешений',
        durationDays: 2,
        laborDays: 1,
        assignments: [{ resource: 'Продюсер', days: 1 }],
        predecessors: [{ no: 3, type: 'FS', lag: 0 }],
        laborCost: 16000,
        expenses: [{ item: 'Охрана', amount: 44000 }],
        note: 'внешняя зависимость · загрузка 50%',
      },
      {
        no: 5,
        name: 'Декор, свет, звук',
        durationDays: 2,
        laborDays: 2,
        assignments: [
          { resource: 'Продюсер', days: 1 },
          { resource: 'Диджей', days: 1 },
        ],
        predecessors: [{ no: 3, type: 'FS', lag: 0 }],
        laborCost: 61000,
        expenses: [{ item: 'Свет и декор', amount: 105000 }],
        note: 'критический путь · загрузка 50%',
      },
      {
        no: 6,
        name: 'Проведение и закрытие площадки',
        durationDays: 1,
        laborDays: 2,
        assignments: [
          { resource: 'Продюсер', days: 1 },
          { resource: 'Диджей', days: 1 },
        ],
        predecessors: [
          { no: 4, type: 'FS', lag: 0 },
          { no: 5, type: 'FS', lag: 0 },
        ],
        laborCost: 61000,
        expenses: [{ item: 'Бар и кейтеринг', amount: 240000 }],
        note: 'веха · День Х',
      },
    ],
    resources: [
      { name: 'Продюсер', kind: 'HUMAN', ratePerDay: 16000, loadDays: 6, cost: 96000 },
      { name: 'Диджей', kind: 'HUMAN', ratePerDay: 45000, loadDays: 2, cost: 90000 },
      { name: 'Аренда площадки', kind: 'EXPENSE', cost: 340000 },
      { name: 'Бар и кейтеринг', kind: 'EXPENSE', cost: 240000 },
      { name: 'Свет и декор', kind: 'EXPENSE', cost: 105000 },
      { name: 'Охрана', kind: 'EXPENSE', cost: 44000 },
    ],
  },
};

export function getPlan(teamId: TeamId): PlannerSheet {
  return PLANS[teamId];
}
