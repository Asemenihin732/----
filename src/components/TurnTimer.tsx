/**
 * Таймер хода команды в шапке экрана команды.
 * Мягкий режим: когда время вышло, выбор не блокируется — идёт красный счётчик
 * переработки, решение за фасилитатором. Управление: пауза, +1 мин, заново.
 */
import { useEffect, useState } from 'react';
import { useSession } from '../game/store';
import { timerLeftMs, type TeamId } from '../game/types';

/** Предупреждаем жёлтым, когда осталось меньше 30 с */
const WARN_MS = 30_000;

/** 185 → «3:05» */
export function formatClock(seconds: number): string {
  const s = Math.abs(Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Текущее время, обновляется раз в 250 мс, пока `active` */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(handle);
  }, [active]);
  return now;
}

const btn =
  'grid h-8 min-w-8 place-items-center rounded-lg border border-line bg-card px-2 text-xs font-semibold text-strong transition hover:bg-soft';

export function TurnTimer({ teamId }: { teamId: TeamId }) {
  const { state, dispatch } = useSession();
  const timer = state.turnTimer;
  const mine = timer && timer.teamId === teamId && timer.round === state.round ? timer : null;
  const paused = mine?.pausedLeft !== null && mine?.pausedLeft !== undefined;
  const now = useNow(Boolean(mine) && !paused);

  if (!mine) return null;

  const left = timerLeftMs(mine, now);
  const over = left < 0;
  const tone = over
    ? 'border-danger/50 bg-danger/10 text-danger'
    : left <= WARN_MS
      ? 'border-warn/50 bg-warn/10 text-warn'
      : 'border-line bg-card text-strong';

  return (
    <div className="flex items-center gap-1.5">
      <div
        data-testid="turn-timer"
        title={over ? 'Время на решение вышло — переработка' : 'Осталось на решение'}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1 font-mono text-lg font-bold tabular-nums ${tone} ${
          over && !paused ? 'animate-pulse' : ''
        }`}
      >
        {over ? <span className="font-sans text-caption font-semibold uppercase">сверх</span> : null}
        <span>
          {over ? '+' : ''}
          {formatClock(left / 1000)}
        </span>
        {paused ? <span className="font-sans text-caption font-semibold uppercase text-muted">пауза</span> : null}
      </div>
      <button
        type="button"
        className={btn}
        data-testid="turn-timer-pause"
        title={paused ? 'Продолжить' : 'Пауза'}
        onClick={() => dispatch({ type: paused ? 'resumeTurn' : 'pauseTurn', now: Date.now() })}
      >
        {paused ? '▶' : '❚❚'}
      </button>
      <button
        type="button"
        className={btn}
        data-testid="turn-timer-extend"
        title="Добавить минуту"
        onClick={() => dispatch({ type: 'extendTurn', seconds: 60 })}
      >
        +1 мин
      </button>
      <button
        type="button"
        className={btn}
        title="Запустить отсчёт заново"
        onClick={() => dispatch({ type: 'restartTurn', now: Date.now() })}
      >
        ↺
      </button>
    </div>
  );
}

export default TurnTimer;
