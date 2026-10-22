/**
 * Диаграмма Ганта проекта: полосы задач по дням.
 * Дни сверх базовой длительности подсвечиваются как «сверх плана».
 */
import type { XlGanttTask } from '../api/types';

export default function GanttChart({
  tasks,
  baseDays,
  actualDays,
}: {
  tasks: XlGanttTask[];
  baseDays: number;
  actualDays: number;
}) {
  const maxDay = Math.max(baseDays, Math.ceil(actualDays), ...tasks.map((t) => Math.ceil(t.endDay)), 1);
  // размеры колонок — в src/styles/ui-scale.css
  const cols = `minmax(var(--ui-gantt-label-width), 1.5fr) repeat(${maxDay}, minmax(var(--ui-gantt-day-min), 1fr))`;

  return (
    // если дни не помещаются по ширине — Гант прокручивается сам, страница не расползается
    <div className="overflow-x-auto">
      {/* шапка дней */}
      <div className="mb-1 grid gap-0.5" style={{ gridTemplateColumns: cols }}>
        <span className="text-caption font-bold text-muted">Задача</span>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <span
            key={d}
            className={`text-center text-caption font-bold ${d > baseDays ? 'text-danger' : 'text-muted'}`}
          >
            {d}
            {d > baseDays ? '†' : ''}
          </span>
        ))}
      </div>

      {tasks.map((t) => (
        <div key={t.id} className="mb-0.5 grid items-center gap-0.5" style={{ gridTemplateColumns: cols }}>
          <span className="truncate text-sm leading-tight" title={t.name}>
            {t.name}
            {t.critical ? ' ✱' : ''}
          </span>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => {
            const on = d >= t.startDay && d <= t.endDay;
            const beyond = d > baseDays;
            return (
              <span
                key={d}
                className={`h-[var(--ui-gantt-bar-height)] rounded ${
                  on ? (t.critical ? 'bg-accent' : 'bg-brand') : beyond ? 'bg-danger/25' : 'bg-soft2'
                }`}
                style={{ opacity: on ? 1 : beyond ? 0.35 : 0.6 }}
              />
            );
          })}
        </div>
      ))}

      <p className="mt-1.5 block text-caption text-muted">
        ✱ — критический путь · † — дни сверх базового плана ({baseDays} дн.) · факт:{' '}
        <b className={actualDays > baseDays ? 'text-danger' : ''}>
          {actualDays.toFixed(1).replace('.', ',')} дн.
        </b>
      </p>
    </div>
  );
}
