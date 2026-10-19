/**
 * Конфигуратор колоды (/deck): у каждой команды по карточке на раунд 1–3.
 * Ведущий правит ситуацию, варианты, текст шагов, действия и платежи X-Lance
 * и последствия. «Сохранить» кладёт колоду в этот браузер — игра сразу играет
 * ею; «Вернуть базовую» — снова колода с сервера (/deck.json).
 */
import { useEffect, useMemo, useState } from 'react';
import type { CardCategory, RoundNumber, TeamId, VariantKey } from '../game/types';
import {
  deckEntries,
  deckSource,
  resetToServerDeck,
  saveBrowserDeck,
  toCard,
  type DeckEntry,
  type DeckSource,
  type DeckVariant,
} from '../data/deck';
import { PROJECTS, getProject } from '../data/projects';
import { categoryLabels } from '../data/labels';
import { CardDetail } from '../components/CardDetail';
import { checkDeck, type DeckIssue } from '../game/deckCheck';
import { VariantEditor } from '../components/deck/VariantEditor';
import { btnOutline, btnPrimary, Field, inputCls, Select, TextInput } from '../components/deck/fields';

const ROUNDS: RoundNumber[] = [1, 2, 3];
const KEYS: VariantKey[] = ['A', 'B', 'C'];
const CATEGORIES = (Object.keys(categoryLabels) as CardCategory[]).filter((c) => c !== 'UNIVERSAL' && c !== 'BONUS');

const SOURCE_LABELS: Record<DeckSource, string> = {
  browser: 'колода из этого браузера (изменённая)',
  server: 'базовая колода с сервера',
  bundled: 'базовая колода из сборки',
};

const clone = (entries: DeckEntry[]): DeckEntry[] => JSON.parse(JSON.stringify(entries)) as DeckEntry[];
const emptyVariant = (): DeckVariant => ({ label: '', steps: [] });

/** Убрать пустые строки шагов перед сохранением. */
function tidy(entries: DeckEntry[]): DeckEntry[] {
  return entries.map((e) => ({
    ...e,
    variants: Object.fromEntries(
      Object.entries(e.variants).map(([k, v]) => [k, { ...v!, steps: v!.steps.map((s) => s.trim()).filter(Boolean) }]),
    ),
  }));
}

export default function DeckEditorPage() {
  const [saved, setSaved] = useState(() => clone(deckEntries));
  const [entries, setEntries] = useState(() => clone(deckEntries));
  const [source, setSource] = useState<DeckSource>(deckSource);
  const [team, setTeam] = useState<TeamId>(PROJECTS[0].id);
  const [round, setRound] = useState<RoundNumber>(1);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = useMemo(() => JSON.stringify(entries) !== JSON.stringify(saved), [entries, saved]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const issues = useMemo(() => checkDeck(entries), [entries]);
  const errors = issues.filter((x) => x.level === 'error');
  const warnings = issues.filter((x) => x.level === 'warning');
  const issuesOf = (t: TeamId, r?: RoundNumber) => issues.filter((x) => x.team === t && (r === undefined || x.round === r));
  const [showIssues, setShowIssues] = useState(false);

  const index = entries.findIndex((e) => e.team === team && e.round === round);
  const entry = index >= 0 ? entries[index] : null;
  const project = getProject(team);

  const updateEntry = (next: DeckEntry) => setEntries(entries.map((e, i) => (i === index ? next : e)));
  const setVariant = (key: VariantKey, v: DeckVariant) => entry && updateEntry({ ...entry, variants: { ...entry.variants, [key]: v } });

  const createCard = () =>
    setEntries([
      ...entries,
      {
        team,
        round,
        category: 'ZAKAZCHIK',
        title: 'Новая карточка',
        description: '',
        variants: { A: emptyVariant(), B: emptyVariant(), C: emptyVariant() },
      },
    ]);

  const toggleBonus = (bonus: boolean) => {
    if (!entry) return;
    if (bonus) {
      const a = entry.variants.A ?? emptyVariant();
      updateEntry({ ...entry, bonus: true, category: 'BONUS', variants: { A: { ...a, label: 'Принять', isChangeRequest: undefined } } });
    } else {
      updateEntry({
        ...entry,
        bonus: undefined,
        category: 'ZAKAZCHIK',
        variants: { A: entry.variants.A ?? emptyVariant(), B: entry.variants.B ?? emptyVariant(), C: entry.variants.C ?? emptyVariant() },
      });
    }
  };

  const save = () => {
    if (errors.length) {
      setMessage({ ok: false, text: `Не сохранено: ошибок в колоде — ${errors.length}. Исправьте отмеченное красным.` });
      setShowIssues(true);
      return;
    }
    try {
      const next = tidy(entries);
      saveBrowserDeck(next);
      setEntries(clone(next));
      setSaved(clone(next));
      setSource('browser');
      setMessage({ ok: true, text: 'Колода сохранена в этом браузере — игра уже играет ею.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const discard = () => {
    setEntries(clone(saved));
    setMessage(null);
  };

  const reset = async () => {
    if (!window.confirm('Вернуть базовую колоду с сервера? Изменения из этого браузера будут удалены.')) return;
    await resetToServerDeck();
    setEntries(clone(deckEntries));
    setSaved(clone(deckEntries));
    setSource(deckSource);
    setMessage({ ok: true, text: 'Вернули базовую колоду.' });
  };

  const previewCard = useMemo(() => {
    if (!entry) return null;
    try {
      return toCard(tidy([entry])[0]);
    } catch {
      return null;
    }
  }, [entry]);

  return (
    <div className="space-y-4" data-testid="deck-editor">
      {/* шапка */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-strong">Колода карточек</h1>
          <p className="text-sm text-muted">
            Сейчас в игре: <span data-testid="deck-source">{SOURCE_LABELS[source]}</span>
            {dirty && <span className="ml-2 text-amber-500">· есть несохранённые изменения</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnOutline} onClick={reset} disabled={source !== 'browser' && !dirty}>
            Вернуть базовую
          </button>
          <button type="button" className={btnOutline} onClick={discard} disabled={!dirty}>
            Отменить изменения
          </button>
          <button type="button" className={btnPrimary} onClick={save} disabled={!dirty} data-testid="deck-save">
            Сохранить
          </button>
        </div>
      </div>
      {message && (
        <p
          data-testid="deck-message"
          className={`rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}
        >
          {message.text}
        </p>
      )}

      {/* итог проверки */}
      <div className="rounded-lg border border-line bg-card px-3 py-2 text-sm" data-testid="deck-check">
        <button type="button" className="text-left" onClick={() => setShowIssues(!showIssues)}>
          {issues.length === 0 ? (
            <span className="text-emerald-600">✓ Проверка колоды: замечаний нет</span>
          ) : (
            <>
              <span className="text-strong">Проверка колоды: </span>
              <span className={errors.length ? 'text-red-500' : 'text-muted'}>ошибок {errors.length}</span>
              <span className="text-muted"> · </span>
              <span className={warnings.length ? 'text-amber-600' : 'text-muted'}>предупреждений {warnings.length}</span>
              <span className="ml-2 text-faint">{showIssues ? 'скрыть' : 'показать'}</span>
            </>
          )}
        </button>
        {showIssues && issues.length > 0 && (
          <ul className="mt-2 space-y-1">
            {issues.map((x, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="text-left hover:underline"
                  onClick={() => {
                    setTeam(x.team);
                    if (x.round) setRound(x.round);
                  }}
                >
                  <span className={x.level === 'error' ? 'text-red-500' : 'text-amber-600'}>●</span>{' '}
                  {getProject(x.team).shortName}
                  {x.round ? `, раунд ${x.round}` : ''}
                  {x.variant ? `, вариант ${x.variant}` : ''}: {x.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* команды и раунды */}
      <div className="flex flex-wrap gap-2">
        {PROJECTS.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid={`deck-team-${p.id}`}
            onClick={() => setTeam(p.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              p.id === team ? 'border-brand bg-brand/10 font-semibold text-strong' : 'border-line bg-card text-muted hover:bg-soft'
            }`}
          >
            {p.emoji} {p.number}. {p.shortName}
            <IssueDot issues={issuesOf(p.id)} />
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {ROUNDS.map((r) => {
          const e = entries.find((x) => x.team === team && x.round === r);
          return (
            <button
              key={r}
              type="button"
              data-testid={`deck-round-${r}`}
              onClick={() => setRound(r)}
              className={`rounded-xl border p-3 text-left transition ${
                r === round ? 'border-brand bg-brand/10' : 'border-line bg-card hover:bg-soft'
              }`}
            >
              <span className="block text-caption uppercase tracking-wide text-faint">
                Раунд {r}
                {e?.bonus ? ' · бонус' : ''}
                <IssueDot issues={issuesOf(team, r)} />
              </span>
              <span className="block truncate text-sm font-semibold text-strong">{e ? e.title : '— нет карточки —'}</span>
            </button>
          );
        })}
      </div>

      {!entry ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="mb-3 text-sm text-muted">
            У команды «{project.shortName}» нет карточки на раунд {round}.
          </p>
          <button type="button" className={btnPrimary} onClick={createCard}>
            Создать карточку
          </button>
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          {/* форма */}
          <div className="space-y-4 rounded-2xl border border-line bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
              <Field label="Заголовок">
                <TextInput value={entry.title} onChange={(title) => updateEntry({ ...entry, title })} />
              </Field>
              <Field label="Категория">
                {entry.bonus ? (
                  <div className={`${inputCls} text-muted`}>Бонус</div>
                ) : (
                  <Select
                    value={entry.category}
                    options={CATEGORIES.map((c) => ({ value: c, label: categoryLabels[c] }))}
                    onChange={(category) => updateEntry({ ...entry, category })}
                  />
                )}
              </Field>
              <label className="flex items-center gap-2 pt-5 text-sm text-strong">
                <input type="checkbox" checked={Boolean(entry.bonus)} onChange={(e) => toggleBonus(e.target.checked)} />
                Бонусная
              </label>
            </div>
            {issuesOf(team, round)
              .filter((x) => !x.variant)
              .map((x, i) => (
                <p
                  key={i}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    x.level === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-600'
                  }`}
                >
                  {x.level === 'error' ? 'Ошибка' : 'Проверьте'}: {x.text}
                </p>
              ))}
            <Field label="Ситуация (описание на карточке)">
              <textarea
                className={`${inputCls} min-h-[4.5rem]`}
                value={entry.description}
                onChange={(e) => updateEntry({ ...entry, description: e.target.value })}
              />
            </Field>

            {KEYS.filter((k) => entry.variants[k]).map((k) => (
              <VariantEditor
                key={`${team}-${round}-${k}`}
                team={team}
                variantKey={k}
                variant={entry.variants[k]!}
                bonus={entry.bonus}
                issues={issuesOf(team, round).filter((x) => x.variant === k)}
                onChange={(v) => setVariant(k, v)}
              />
            ))}
          </div>

          {/* превью */}
          <div className="xl:sticky xl:top-4">
            <p className="mb-2 text-caption uppercase tracking-wide text-faint">Так карточку увидят игроки</p>
            {previewCard ? (
              <CardDetail card={previewCard} accent={project.accent} onChoose={() => undefined} stacked />
            ) : (
              <p className="text-sm text-muted">Превью недоступно.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Точка у команды или раунда: красная — есть ошибки, жёлтая — предупреждения. */
function IssueDot({ issues }: { issues: DeckIssue[] }) {
  if (!issues.length) return null;
  const error = issues.some((x) => x.level === 'error');
  return (
    <span
      title={error ? 'есть ошибки' : 'есть предупреждения'}
      className={`ml-1.5 inline-block h-2 w-2 rounded-full align-middle ${error ? 'bg-red-500' : 'bg-amber-500'}`}
    />
  );
}
