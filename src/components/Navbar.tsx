/**
 * Верхняя панель: кнопка меню (мобильные), заголовок игры, имя пользователя,
 * переключатель темы и выход. Тема — через [data-mode] на <html> (см. App.tsx).
 */
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { XlanceLogo } from './XLanceLogo';

type Mode = 'light' | 'dark';

/* ---------------------------------- иконки --------------------------------- */

const IconMenu = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
  </svg>
);
const IconSun = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
  </svg>
);
const IconMoon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
  </svg>
);
const IconLogout = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface Props {
  /** Открыть мобильную панель меню. */
  onOpenMenu: () => void;
}

export function Navbar({ onOpenMenu }: Props) {
  const { user, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return (localStorage.getItem('xlance-theme-mode') as Mode) ?? 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    try {
      localStorage.setItem('xlance-theme-mode', next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('xlance-theme-mode', { detail: next }));
  };

  return (
    <header className="no-print z-30 flex h-10 shrink-0 items-center gap-2 bg-shell px-3.5 text-shelltext">
      <button
        type="button"
        onClick={onOpenMenu}
        className="rounded-md p-1.5 text-shellmuted transition hover:bg-shelltext/[0.06] hover:text-shelltext md:hidden "
        aria-label="Меню"
      >
        <IconMenu />
      </button>
      <XlanceLogo iconOnly size="sm" />
      <h1 className="truncate text-sm font-semibold">
        Деловая игра «Спаси конференцию!»
      </h1>

      <div className="ml-auto flex items-center gap-2">
        {user ? (
          <span
            title={user.email}
            className="hidden rounded-full bg-card px-2.5 py-0.5 text-xs font-medium shadow-[0_0_0_1px_var(--c-line)] sm:inline-block"
          >
            {`${user.firstName} ${user.lastName}`.trim() || user.email}
          </span>
        ) : null}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-md p-1.5 text-shellmuted transition hover:bg-shelltext/[0.06] hover:text-shelltext"
          aria-label="Переключить тему"
          title={mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          {mode === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        {user ? (
          <button
            type="button"
            onClick={signOut}
            className="rounded-md p-1.5 text-shellmuted transition hover:bg-shelltext/[0.06] hover:text-shelltext"
            aria-label="Выйти"
            title="Выйти"
          >
            <IconLogout />
          </button>
        ) : null}
      </div>
    </header>
  );
}

export default Navbar;
