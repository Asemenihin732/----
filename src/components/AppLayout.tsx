/**
 * Каркас приложения: боковое меню, верхняя панель с режимом API и переключателем темы.
 * Tailwind v4, тема — через [data-mode] на <html>.
 */
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../game/store';
import { useAuth } from '../auth/AuthProvider';
import { getProject } from '../data/projects';
import { apiConfig } from '../api/config';
import { XlanceLogo } from './XLanceLogo';

type Mode = 'light' | 'dark';

/* ---------------------------------- иконки --------------------------------- */

const IconMenu = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
  </svg>
);
const IconGame = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="7" width="18" height="11" rx="4" />
    <path d="M8 12h2M9 11v2M15 12h.01M17 14h.01" strokeLinecap="round" />
  </svg>
);
const IconTrophy = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 20h6M12 12v8" strokeLinecap="round" />
  </svg>
);
const IconSun = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
  </svg>
);
const IconMoon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
  </svg>
);
const IconLogout = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* --------------------------------- каркас ---------------------------------- */

const NAV = [
  { to: '/', label: 'Игра', icon: <IconGame /> },
  { to: '/results', label: 'Итоги', icon: <IconTrophy /> },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return (localStorage.getItem('xlance-theme-mode') as Mode) ?? 'dark';
    } catch {
      return 'dark';
    }
  });
  const { state } = useSession();
  const { user, signOut } = useAuth();

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

  const sidebar = (
    <div className="flex h-full flex-col bg-shell text-shelltext">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-shell text-sm font-black text-white">
          X
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-extrabold">X-Lance</span>
          <span className="block text-xs text-shellmuted">Спаси конференцию!</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? 'bg-white/10 text-shelltext' : 'text-shellmuted hover:bg-white/[0.07] hover:text-shelltext'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}

        {state.teamOrder.length > 0 ? (
          <>
            <p className="mt-2 px-3 text-[11px] uppercase tracking-wide text-shellmuted/70">Команды</p>
            {state.teamOrder.map((id, i) => {
              const p = getProject(id);
              return (
                <NavLink
                  key={id}
                  to={`/team/${id}`}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `mb-0.5 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                      isActive ? 'bg-white/10 text-shelltext' : 'text-shellmuted hover:bg-white/[0.07] hover:text-shelltext'
                    }`
                  }
                >
                  <span>{p.emoji}</span>
                  <span className="truncate">
                    {i + 1}. {p.shortName}
                  </span>
                </NavLink>
              );
            })}
          </>
        ) : null}
      </nav>

      <div className=" px-4 py-3 ">
        <XlanceLogo/>
      </div>
       
    </div>
  );

  return (
    <div className="flex min-h-screen bg-canvas text-strong">
      <aside className="no-print hidden w-60 shrink-0 md:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Закрыть меню"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-60 shadow-2xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col bg-shell">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 bg-shell px-3 py-2 text-shelltext sm:px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 hover:bg-white/10 md:hidden "
            aria-label="Меню"
          >
            <IconMenu />
          </button>
          <h1 className="truncate text-sm font-extrabold sm:text-base">
            Деловая игра «Спаси конференцию!»
          </h1>
         

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <span
                title={user.email}
                className="hidden rounded-full border border-white/25 px-3 py-1 text-xs sm:inline-block"
              >
                {`${user.firstName} ${user.lastName}`.trim() || user.email}
              </span>
            ) : null}
            {/* <span
              title={
                apiConfig.mode === 'mock'
                  ? 'Демо-режим: mock X-Lance API (localStorage)'
                  : `Реальный X-Lance API: ${apiConfig.baseUrl || 'URL не задан'}`
              }
              className={`hidden rounded-full border px-3 py-1 text-xs sm:inline-block ${
                apiConfig.mode === 'mock'
                  ? 'border-amber-400/50 text-amber-300'
                  : 'border-emerald-400/50 text-emerald-300'
              }`}
            >
              {apiConfig.mode === 'mock' ? 'MOCK API' : 'HTTP API'}
            </span> */}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-1.5 hover:bg-white/10"
              aria-label="Переключить тему"
              title={mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            >
              {mode === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            {user ? (
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg p-1.5 hover:bg-white/10"
                aria-label="Выйти"
                title="Выйти"
              >
                <IconLogout />
              </button>
            ) : null}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 rounded-2xl bg-card mb-2">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
