/**
 * Таймер хода команды в шапке экрана команды.
 * Мягкий режим: когда время вышло, выбор не блокируется — таймер стоит на 0:00,
 * мигает красным и пищит, пока фасилитатор не отреагирует (пауза, +1 мин, заново,
 * «тише») или команда не выберет решение. Ниже нуля не считаем.
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

/* ---------------------------------- писк ---------------------------------- */

const BEEP_EVERY_MS = 1000;
let audio: AudioContext | null = null;

/**
 * Браузер не даёт звучать без действия пользователя — поэтому AudioContext создаём
 * (и будим) на первом клике по странице: к нулю таймера звук уже разрешён.
 */
function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    /* Web Audio недоступен — без звука */
  }
}
if (typeof window !== 'undefined') window.addEventListener('pointerdown', unlockAudio, { capture: true });

/** Два коротких сигнала */
function beep(): void {
  unlockAudio();
  if (!audio || audio.state !== 'running') return;
  const t = audio.currentTime;
  for (const start of [0, 0.25]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t + start);
    gain.gain.exponentialRampToValueAtTime(0.2, t + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.15);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + start);
    osc.stop(t + start + 0.16);
  }
}

/** Пищит раз в секунду, пока `on` */
function useBeeping(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    beep();
    const handle = window.setInterval(beep, BEEP_EVERY_MS);
    return () => window.clearInterval(handle);
  }, [on]);
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

  const left = mine ? Math.max(0, timerLeftMs(mine, now)) : 1;
  const over = left <= 0;
  // «тише» глушит писк этого отсчёта; +1 мин или «заново» дают новый дедлайн — и новый писк
  const [mutedDeadline, setMutedDeadline] = useState<number | null>(null);
  const deadline = mine?.deadline ?? null;
  const muted = mutedDeadline !== null && mutedDeadline === deadline;
  useBeeping(Boolean(mine) && over && !paused && !muted);

  if (!mine) return null;

  const tone = over
    ? 'border-danger/50 bg-danger/10 text-danger'
    : left <= WARN_MS
      ? 'border-warn/50 bg-warn/10 text-warn'
      : 'border-line bg-card text-strong';

  return (
    <div className="flex items-center gap-1.5">
      <div
        data-testid="turn-timer"
        title={over ? 'Время на решение вышло' : 'Осталось на решение'}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1 font-mono text-lg font-bold tabular-nums ${tone} ${
          over && !paused ? 'animate-pulse' : ''
        }`}
      >
        {over ? <span className="font-sans text-caption font-semibold uppercase">время</span> : null}
        <span>{formatClock(Math.ceil(left / 1000))}</span>
        {paused ? <span className="font-sans text-caption font-semibold uppercase text-muted">пауза</span> : null}
      </div>
      {over && !paused && !muted ? (
        <button
          type="button"
          className={btn}
          data-testid="turn-timer-mute"
          title="Выключить писк"
          onClick={() => setMutedDeadline(deadline)}
        >
          🔇 тише
        </button>
      ) : null}
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
        onClick={() => dispatch({ type: 'extendTurn', seconds: 60, now: Date.now() })}
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
