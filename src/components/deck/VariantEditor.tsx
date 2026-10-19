/**
 * Редактор одного варианта карточки: название, шаги (текст для игроков),
 * действия в X-Lance, платежи и последствия в игре.
 *
 * Шаги — свободный текст ведущего; действия и платежи — то, что игра
 * реально выполняет в X-Lance при выборе варианта. Они задаются отдельно.
 */
import type { CardPayment, TeamId, XlAction } from '../../game/types';
import type { DeckVariant } from '../../data/deck';
import { getPlan } from '../../data/plan';
import { getProject } from '../../data/projects';
import { btnDelete, btnSmall, Field, inputCls, NumberInput, Select, TextInput } from './fields';

interface Props {
  team: TeamId;
  variantKey: string;
  variant: DeckVariant;
  onChange: (v: DeckVariant) => void;
  /** Бонусная карточка: название варианта фиксированное («Принять») */
  bonus?: boolean;
}

const ACTION_LABELS: Record<XlAction['type'], string> = {
  duration: 'Изменить длительность задачи',
  addTask: 'Добавить задачу',
  labor: 'Трудозатраты человека на задаче',
  reassign: 'Переназначить задачу',
  extendProject: 'Продлить проект',
  manual: 'Ручной шаг (только текст)',
};
const ACTION_ORDER: XlAction['type'][] = ['duration', 'addTask', 'labor', 'reassign', 'manual', 'extendProject'];

type PaymentKind = 'expense' | 'income' | 'reduce';
const PAYMENT_LABELS: Record<PaymentKind, string> = {
  expense: 'Расход',
  income: 'Доход',
  reduce: 'Сократить расход по статье',
};

const kindOf = (p: CardPayment): PaymentKind => (p.reduce ? 'reduce' : p.amount < 0 ? 'expense' : 'income');

/** Задача, у которой показывается изменение срока: первая изменённая или новая. */
function deltaTaskName(actions: XlAction[] | undefined): string {
  for (const a of actions ?? []) {
    if (a.type === 'duration') return a.task;
    if (a.type === 'addTask') return a.name;
  }
  return 'Проект';
}

export function VariantEditor({ team, variantKey, variant, onChange, bonus }: Props) {
  const plan = getPlan(team);
  const tasks = plan.tasks.map((t) => t.name);
  const people = plan.resources.filter((r) => r.kind === 'HUMAN').map((r) => r.name);
  const budgetItems = getProject(team).budget.map((b) => b.item);
  // новые задачи этого варианта тоже можно выбирать в других действиях
  const allTasks = [...tasks, ...(variant.actions ?? []).flatMap((a) => (a.type === 'addTask' && a.name ? [a.name] : []))];

  const set = (patch: Partial<DeckVariant>) => onChange({ ...variant, ...patch });
  const actions = variant.actions ?? [];
  const payments = variant.payments ?? [];
  const setAction = (i: number, a: XlAction) => set({ actions: actions.map((x, j) => (j === i ? a : x)) });
  const setPayment = (i: number, p: CardPayment) => set({ payments: payments.map((x, j) => (j === i ? p : x)) });

  const newAction = (type: XlAction['type']): XlAction => {
    switch (type) {
      case 'duration':
        return { type, task: tasks[0] ?? '', days: 1 };
      case 'addTask':
        return { type, name: '', days: 1, anchor: tasks[tasks.length - 1] ?? '', placement: 'before', assign: [] };
      case 'labor':
        return { type, task: tasks[0] ?? '', resource: people[0] ?? '', days: 1 };
      case 'reassign':
        return { type, task: tasks[0] ?? '', from: people[0] ?? '', to: people[1] ?? '' };
      case 'extendProject':
        return { type, days: 1 };
      case 'manual':
        return { type, text: '' };
    }
  };

  const taskOptions = (current: string) =>
    [...new Set([...allTasks, ...(current && !allTasks.includes(current) ? [current] : [])])].map((t) => ({
      value: t,
      label: allTasks.includes(t) ? t : `${t} (нет в плане)`,
    }));
  const personOptions = (current: string) =>
    [...people, ...(current && !people.includes(current) ? [current] : [])].map((p) => ({
      value: p,
      label: people.includes(p) ? p : `${p} (нет в плане)`,
    }));
  const itemOptions = [{ value: '', label: '— без статьи —' }, ...budgetItems.map((b) => ({ value: b, label: b }))];

  return (
    <div className="space-y-4 rounded-xl border border-line bg-soft p-4" data-testid={`editor-variant-${variantKey}`}>
      {/* название */}
      <div className="flex flex-wrap items-end gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
          {variantKey}
        </span>
        <Field label="Название варианта" className="min-w-[14rem] flex-1">
          <TextInput value={variant.label} onChange={(label) => set({ label })} placeholder={bonus ? 'Принять' : ''} />
        </Field>
        {!bonus && (
          <label className="flex items-center gap-2 pb-2 text-sm text-strong">
            <input
              type="checkbox"
              checked={Boolean(variant.isChangeRequest)}
              onChange={(e) => set({ isChangeRequest: e.target.checked || undefined })}
            />
            Запрос на изменение
          </label>
        )}
      </div>

      {/* шаги — текст на карточке */}
      <Field label="Что сделать в X-Lance — текст на карточке (по шагу в строке)">
        <textarea
          className={`${inputCls} min-h-[6rem] font-normal`}
          value={variant.steps.join('\n')}
          onChange={(e) => set({ steps: e.target.value.split('\n') })}
        />
      </Field>

      {/* действия с задачами и людьми */}
      <section>
        <h4 className="mb-2 text-sm font-semibold text-strong">Действия в X-Lance — задачи и люди</h4>
        <div className="space-y-2">
          {actions.map((a, i) => (
            <div key={i} className="rounded-lg border border-line bg-card p-3" data-testid={`action-${variantKey}-${i}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-strong">{ACTION_LABELS[a.type]}</span>
                <button type="button" className={btnDelete} onClick={() => set({ actions: actions.filter((_, j) => j !== i) })}>
                  удалить
                </button>
              </div>
              <ActionFields
                action={a}
                onChange={(x) => setAction(i, x)}
                taskOptions={taskOptions}
                personOptions={personOptions}
                tasks={tasks}
              />
            </div>
          ))}
        </div>
        <AddMenu
          label="+ действие"
          options={ACTION_ORDER.map((t) => ({ value: t, label: ACTION_LABELS[t] }))}
          onPick={(t) => set({ actions: [...actions, newAction(t)] })}
        />
      </section>

      {/* платежи */}
      <section>
        <h4 className="mb-2 text-sm font-semibold text-strong">Платежи в X-Lance</h4>
        <div className="space-y-2">
          {payments.map((p, i) => {
            const kind = kindOf(p);
            return (
              <div key={i} className="space-y-2 rounded-lg border border-line bg-card p-3" data-testid={`payment-${variantKey}-${i}`}>
                <div className="grid gap-2 sm:grid-cols-[minmax(10rem,14rem)_1fr]">
                  <Select
                    value={kind}
                    options={(Object.keys(PAYMENT_LABELS) as PaymentKind[]).map((k) => ({ value: k, label: PAYMENT_LABELS[k] }))}
                    onChange={(k) => {
                      const abs = Math.abs(p.amount);
                      if (k === 'expense') setPayment(i, { name: p.name, amount: -abs, expenseItem: p.expenseItem });
                      if (k === 'income') setPayment(i, { name: p.name, amount: abs });
                      if (k === 'reduce') setPayment(i, { name: p.name, amount: abs, expenseItem: p.expenseItem ?? budgetItems[0], reduce: true });
                    }}
                  />
                  <TextInput value={p.name} onChange={(name) => setPayment(i, { ...p, name })} placeholder="Название платежа" />
                </div>
                <div className="grid items-center gap-2 sm:grid-cols-[minmax(8rem,12rem)_1fr_auto]">
                  <NumberInput
                    value={Math.abs(p.amount)}
                    onChange={(v) => setPayment(i, { ...p, amount: kind === 'expense' ? -(v ?? 0) : v ?? 0 })}
                    placeholder="Сумма, ₽"
                    step={1000}
                  />
                  {kind === 'income' ? (
                    <span className="text-xs text-faint">входящий платёж, статья не нужна</span>
                  ) : (
                    <Select
                      value={p.expenseItem ?? ''}
                      options={itemOptions.filter((o) => kind !== 'reduce' || o.value)}
                      onChange={(item) => setPayment(i, { ...p, expenseItem: item || undefined })}
                    />
                  )}
                  <button type="button" className={btnDelete} onClick={() => set({ payments: payments.filter((_, j) => j !== i) })}>
                    удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <AddMenu
          label="+ платёж"
          options={(Object.keys(PAYMENT_LABELS) as PaymentKind[]).map((k) => ({ value: k, label: PAYMENT_LABELS[k] }))}
          onPick={(k) => {
            const p: CardPayment =
              k === 'expense'
                ? { name: '', amount: -10_000 }
                : k === 'income'
                  ? { name: '', amount: 10_000 }
                  : { name: '', amount: 10_000, expenseItem: budgetItems[0], reduce: true };
            set({ payments: [...payments, p] });
          }}
        />
      </section>

      {/* последствия */}
      <section>
        <h4 className="mb-2 text-sm font-semibold text-strong">Последствия в игре</h4>
        <div className="grid gap-2 sm:grid-cols-5">
          <Field label="Срок, ± дн.">
            <NumberInput
              value={variant.deltaDays?.deltaDay}
              onChange={(d) =>
                set({ deltaDays: d ? { taskName: deltaTaskName(variant.actions), deltaDay: d } : undefined })
              }
            />
          </Field>
          <Field label="Расход, ₽">
            <NumberInput value={variant.deltaCost} onChange={(deltaCost) => set({ deltaCost })} step={1000} />
          </Field>
          <Field label="в т. ч. труд, ₽">
            <NumberInput value={variant.laborCost} onChange={(laborCost) => set({ laborCost })} step={1000} />
          </Field>
          <Field label="Доход, ₽">
            <NumberInput value={variant.deltaRevenue} onChange={(deltaRevenue) => set({ deltaRevenue })} step={1000} />
          </Field>
          <Field label="Удовл., ± п.п.">
            <NumberInput value={variant.deltaSatisfaction} onChange={(deltaSatisfaction) => set({ deltaSatisfaction })} />
          </Field>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------ поля действия ------------------------------ */

type Options = (current: string) => { value: string; label: string }[];

function ActionFields({
  action: a,
  onChange,
  taskOptions,
  personOptions,
  tasks,
}: {
  action: XlAction;
  onChange: (a: XlAction) => void;
  taskOptions: Options;
  personOptions: Options;
  tasks: string[];
}) {
  switch (a.type) {
    case 'duration':
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <Field label="Задача">
            <Select value={a.task} options={taskOptions(a.task)} onChange={(task) => onChange({ ...a, task })} />
          </Field>
          <Field label="± дней">
            <NumberInput value={a.days} onChange={(days) => onChange({ ...a, days: days ?? 0 })} />
          </Field>
        </div>
      );
    case 'extendProject':
      return (
        <Field label="± дней к сроку проекта (последняя задача)">
          <NumberInput value={a.days} onChange={(days) => onChange({ ...a, days: days ?? 0 })} />
        </Field>
      );
    case 'labor':
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem]">
          <Field label="Задача">
            <Select value={a.task} options={taskOptions(a.task)} onChange={(task) => onChange({ ...a, task })} />
          </Field>
          <Field label="Человек">
            <Select value={a.resource} options={personOptions(a.resource)} onChange={(resource) => onChange({ ...a, resource })} />
          </Field>
          <Field label="± чел.-дней">
            <NumberInput value={a.days} onChange={(days) => onChange({ ...a, days: days ?? 0 })} />
          </Field>
        </div>
      );
    case 'reassign':
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Задача">
            <Select value={a.task} options={taskOptions(a.task)} onChange={(task) => onChange({ ...a, task })} />
          </Field>
          <Field label="С кого">
            <Select value={a.from} options={personOptions(a.from)} onChange={(from) => onChange({ ...a, from })} />
          </Field>
          <Field label="На кого (можно нового)">
            <TextInput value={a.to} onChange={(to) => onChange({ ...a, to })} list="deck-people" />
            <datalist id="deck-people">
              {personOptions('').map((o) => (
                <option key={o.value} value={o.value} />
              ))}
            </datalist>
          </Field>
        </div>
      );
    case 'manual':
      return (
        <Field label="Что сделать вручную (в X-Lance не отправляется)">
          <TextInput value={a.text} onChange={(text) => onChange({ ...a, text })} />
        </Field>
      );
    case 'addTask': {
      const assign = a.assign ?? [];
      const setAssign = (next: typeof assign) => onChange({ ...a, assign: next });
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
            <Field label="Название новой задачи">
              <TextInput value={a.name} onChange={(name) => onChange({ ...a, name })} />
            </Field>
            <Field label="Дней">
              <NumberInput value={a.days} onChange={(days) => onChange({ ...a, days: Math.max(1, Math.round(days ?? 1)) })} />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <Field label="Где в плане">
              <Select
                value={a.placement}
                options={[
                  { value: 'before', label: 'Перед задачей (срок +)' },
                  { value: 'parallel', label: 'Параллельно задаче' },
                ]}
                onChange={(placement) => onChange({ ...a, placement })}
              />
            </Field>
            <Field label="Задача-якорь">
              <Select
                value={a.anchor}
                options={taskOptions(a.anchor).filter((o) => tasks.includes(o.value) || o.value === a.anchor)}
                onChange={(anchor) => onChange({ ...a, anchor })}
              />
            </Field>
          </div>
          <div>
            <span className="mb-1 block text-caption font-semibold uppercase tracking-wide text-faint">
              Исполнители (чел.-дни; 0 — назначен, оплата отдельным платежом)
            </span>
            <div className="space-y-1.5">
              {assign.map((x, i) => (
                <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2">
                  <Select
                    value={x.resource}
                    options={personOptions(x.resource)}
                    onChange={(resource) => setAssign(assign.map((y, j) => (j === i ? { ...y, resource } : y)))}
                  />
                  <NumberInput
                    value={x.days}
                    onChange={(days) => setAssign(assign.map((y, j) => (j === i ? { ...y, days: days ?? 0 } : y)))}
                  />
                  <button type="button" className={btnDelete} onClick={() => setAssign(assign.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={`${btnSmall} mt-1.5`}
              onClick={() => setAssign([...assign, { resource: personOptions('')[0]?.value ?? '', days: a.days }])}
            >
              + исполнитель
            </button>
          </div>
        </div>
      );
    }
  }
}

/** Кнопка-список «добавить …»: выбор пункта сразу добавляет его. */
function AddMenu<T extends string>({
  label,
  options,
  onPick,
}: {
  label: string;
  options: { value: T; label: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <select
      className={`${btnSmall} mt-2 cursor-pointer`}
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value as T);
      }}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
