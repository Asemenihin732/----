/**
 * Колода карточек. Базовая колода — файл src/data/deck.json, на сайте — /deck.json (18 карточек по
 * «UPD текст X-Lance_Koloda_18_kartochek_itog.docx»): он лежит на сервере рядом
 * с сайтом, и заменить колоду можно без пересборки — достаточно подменить файл.
 *
 * При запуске игра вызывает `loadDeck()`: колода, сохранённая в этом браузере
 * (конфигуратор), иначе deck.json с сервера, иначе копия, собранная в бандл.
 *
 * «Стоимость трудозатрат» на карточке — не отдельный платёж: X-Lance сам
 * пересчитывает труд при изменении длительности задачи или назначении
 * исполнителей новой задачи. В `deltaCost` труд входит (как в «Последствиях»).
 *
 * В раундах 1–3 каждая команда получает именно эти карточки, какую бы закрытую
 * карту она ни выбрала. Колода самодостаточна: заголовки, описания, варианты,
 * шаги и все числа берутся только отсюда (не из data/cards.ts).
 *
 * Бонусные карточки (`bonus: true`) — с одним вариантом «Принять».
 */
import type {
  Card,
  CardCategory,
  CardPayment,
  RoundNumber,
  TeamId,
  Variant,
  VariantKey,
  XlAction,
} from '../game/types';
import baseDeckFile from './deck.json' with { type: 'json' };

export interface DeckVariant {
  /** Название варианта — как на карточке */
  label: string;
  /** Шаги «Что сделать в X-Lance» — дословно с карточки */
  steps: string[];
  /** Задача, у которой меняется длительность, и на сколько дней */
  deltaDays?: { taskName: string; deltaDay: number };
  /** Изменение расходов, ₽ (минус — расход уменьшается) */
  deltaCost?: number;
  /** Сколько из расхода — труд (в «Последствиях»: «в т. ч. труд …»), ₽ */
  laborCost?: number;
  /** Изменение дохода, ₽ */
  deltaRevenue?: number;
  /** Изменение удовлетворённости заказчика, п.п. */
  deltaSatisfaction?: number;
  /** Вариант оформляется запросом на изменение */
  isChangeRequest?: boolean;
  /**
   * Платежи, которые решение создаёт в X-Lance.
   * Знак суммы задаёт направление: минус — исходящий платёж, плюс — входящий.
   * `reduce: true` — не новый платёж, а уменьшение базового расхода по статье.
   */
  payments?: CardPayment[];
  /** Действия с задачами и ресурсами X-Lance; шаги без API — `manual` */
  actions?: XlAction[];
}

export interface DeckEntry {
  team: TeamId;
  round: RoundNumber;
  /** Бонусная карточка (на карточке «РАУНД N · БОНУС») */
  bonus?: boolean;
  category: CardCategory;
  title: string;
  description: string;
  variants: Partial<Record<VariantKey, DeckVariant>>;
}

/** Новая задача «AI-фотобудка» — общая для вариантов A и B (труд 28 000 ₽ считает X-Lance). */
/** Файл колоды (deck.json): версия формата и карточки. */
export interface DeckFile {
  version: 1;
  cards: DeckEntry[];
}

/** Откуда взята текущая колода. */
export type DeckSource = 'browser' | 'server' | 'bundled';

/** Ключ колоды, сохранённой в этом браузере (конфигуратор). */
export const DECK_STORAGE_KEY = 'xlance-deck-v1';

const TEAMS: readonly TeamId[] = ['catering', 'stage', 'entertainment', 'merch', 'logistics', 'afterparty'];
const CATEGORIES: readonly CardCategory[] = ['LUDI', 'PODRYADCHIKI', 'ZAKAZCHIK', 'FORS_MAJOR', 'RESURSY', 'UNIVERSAL', 'BONUS'];
const ACTION_TYPES: readonly XlAction['type'][] = ['duration', 'extendProject', 'addTask', 'labor', 'reassign', 'manual'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optNumber = (v: unknown) => v === undefined || isNumber(v);

/**
 * Проверить содержимое файла колоды и вернуть карточки.
 * Ошибка называет карточку и поле — её можно показать ведущему как есть.
 */
export function parseDeckFile(raw: unknown): DeckEntry[] {
  if (!isObject(raw) || raw.version !== 1 || !Array.isArray(raw.cards)) {
    throw new Error('Файл колоды: ожидается { "version": 1, "cards": [...] }');
  }
  raw.cards.forEach((card: unknown, i) => {
    const where = `Карточка ${i + 1}`;
    if (!isObject(card)) throw new Error(`${where}: не объект`);
    if (!TEAMS.includes(card.team as TeamId)) throw new Error(`${where}: неизвестная команда «${String(card.team)}»`);
    if (![1, 2, 3].includes(card.round as number)) throw new Error(`${where}: раунд должен быть 1, 2 или 3`);
    if (!CATEGORIES.includes(card.category as CardCategory)) throw new Error(`${where}: неизвестная категория «${String(card.category)}»`);
    if (typeof card.title !== 'string' || !card.title.trim()) throw new Error(`${where}: нет заголовка`);
    if (typeof card.description !== 'string') throw new Error(`${where} «${card.title}»: нет описания`);
    if (!isObject(card.variants)) throw new Error(`${where} «${card.title}»: нет вариантов`);
    const keys = Object.keys(card.variants);
    if (!keys.length || keys.some((k) => !['A', 'B', 'C'].includes(k))) {
      throw new Error(`«${card.title}»: варианты должны называться A, B, C`);
    }
    for (const key of keys) {
      const v = card.variants[key];
      const at = `«${card.title}», вариант ${key}`;
      if (!isObject(v)) throw new Error(`${at}: не объект`);
      if (typeof v.label !== 'string' || !v.label.trim()) throw new Error(`${at}: нет названия`);
      if (!Array.isArray(v.steps) || v.steps.some((x) => typeof x !== 'string')) throw new Error(`${at}: шаги — список строк`);
      for (const f of ['deltaCost', 'laborCost', 'deltaRevenue', 'deltaSatisfaction'] as const) {
        if (!optNumber(v[f])) throw new Error(`${at}: ${f} — не число`);
      }
      if (v.deltaDays !== undefined && !(isObject(v.deltaDays) && isNumber(v.deltaDays.deltaDay))) {
        throw new Error(`${at}: deltaDays — { taskName, deltaDay }`);
      }
      if (v.payments !== undefined) {
        if (!Array.isArray(v.payments)) throw new Error(`${at}: payments — список`);
        for (const p of v.payments) {
          if (!isObject(p) || typeof p.name !== 'string' || !isNumber(p.amount)) throw new Error(`${at}: платёж — { name, amount }`);
        }
      }
      if (v.actions !== undefined) {
        if (!Array.isArray(v.actions)) throw new Error(`${at}: actions — список`);
        for (const a of v.actions) {
          if (!isObject(a) || !ACTION_TYPES.includes(a.type as XlAction['type'])) {
            throw new Error(`${at}: неизвестное действие «${isObject(a) ? String(a.type) : a}»`);
          }
        }
      }
    }
  });
  return raw.cards as DeckEntry[];
}

function toVariant(key: VariantKey, d: DeckVariant): Variant {
  return {
    key,
    label: d.label,
    deltaDays: d.deltaDays?.deltaDay,
    targetTask: d.deltaDays?.taskName,
    deltaCost: d.deltaCost,
    laborCost: d.laborCost,
    deltaRevenue: d.deltaRevenue,
    deltaSatisfaction: d.deltaSatisfaction,
    isChangeRequest: d.isChangeRequest,
    xlanceAction: d.steps.join('; '),
    xlanceSteps: d.steps,
    // колода описывает деньги полностью: нет платежей — значит, платежей нет
    payments: d.payments ?? [],
    actions: d.actions,
  };
}

/** Карточка игры из записи колоды (её же показывает превью конфигуратора). */
export function toCard(entry: DeckEntry): Card {
  return {
    id: `deck-${entry.team}-${entry.round}`,
    team: entry.team,
    round: entry.round,
    category: entry.category,
    title: entry.title,
    flavor: entry.description,
    bonus: entry.bonus,
    variants: (Object.keys(entry.variants) as VariantKey[]).map((key) => toVariant(key, entry.variants[key]!)),
  };
}

/** Все карточки текущей колоды в порядке файла (меняется `setDeck`). */
export let deckCards: Card[] = [];
/** Текущая колода в формате файла — её правит конфигуратор. */
export let deckEntries: DeckEntry[] = [];
/** Откуда взята текущая колода. */
export let deckSource: DeckSource = 'bundled';
let designated = new Map<string, Card>();

/** Сделать колоду текущей. */
export function setDeck(entries: DeckEntry[], source: DeckSource): void {
  deckEntries = entries;
  deckCards = entries.map(toCard);
  deckSource = source;
  designated = new Map(deckCards.map((card) => [`${card.team}:${card.round}`, card]));
}

// до загрузки (и в тестах) — копия базовой колоды из бандла
setDeck(parseDeckFile(baseDeckFile), 'bundled');

/**
 * Загрузить колоду при запуске игры: сохранённая в браузере → deck.json с
 * сервера → копия из бандла. Битая колода пропускается с предупреждением.
 */
export async function loadDeck(): Promise<DeckSource> {
  if (readBrowserDeck()) return deckSource;
  await loadServerDeck();
  return deckSource;
}

/** Колода, сохранённая в этом браузере, — если есть и корректна. */
function readBrowserDeck(): boolean {
  try {
    const saved = localStorage.getItem(DECK_STORAGE_KEY);
    if (!saved) return false;
    setDeck(parseDeckFile(JSON.parse(saved)), 'browser');
    return true;
  } catch (e) {
    console.warn('Колода из браузера не подошла, берём с сервера:', e);
    return false;
  }
}

/** Базовая колода с сервера (/deck.json), при ошибке — копия из сборки. */
async function loadServerDeck(): Promise<void> {
  try {
    const res = await fetch(new URL('deck.json', document.baseURI), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setDeck(parseDeckFile(await res.json()), 'server');
  } catch (e) {
    console.warn('deck.json с сервера не загрузился, играем базовой колодой из сборки:', e);
    setDeck(parseDeckFile(baseDeckFile), 'bundled');
  }
}

/** Сохранить колоду в этом браузере и сразу играть ею. Ошибка формата — исключение. */
export function saveBrowserDeck(entries: DeckEntry[]): void {
  const file: DeckFile = { version: 1, cards: entries };
  const checked = parseDeckFile(JSON.parse(JSON.stringify(file)));
  localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(file));
  setDeck(checked, 'browser');
}

/** Забыть колоду браузера и вернуться к базовой с сервера. */
export async function resetToServerDeck(): Promise<void> {
  try {
    localStorage.removeItem(DECK_STORAGE_KEY);
  } catch {
    // хранилище недоступно — колоды браузера и так нет
  }
  await loadServerDeck();
}

/** Карточка, которая выпадает команде в раундах 1–3 при выборе любой закрытой карты. */
export function designatedCard(team: TeamId, round: number): Card | null {
  return designated.get(`${team}:${round}`) ?? null;
}
