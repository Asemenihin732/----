/**
 * Боковое меню: переходы по игре и список команд текущей сессии.
 * Используется в AppLayout — и на десктопе (aside), и в мобильной выезжающей панели.
 */
import { NavLink } from 'react-router-dom';
import { useSession } from '../game/store';
import { getProject } from '../data/projects';
import { XlanceLogo } from './XLanceLogo';

/* ---------------------------------- иконки --------------------------------- */

const IconGame = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="7" width="18" height="11" rx="4" />
    <path d="M8 12h2M9 11v2M15 12h.01M17 14h.01" strokeLinecap="round" />
  </svg>
);
const IconTrophy = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M7 4h10v3a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 20h6M12 12v8" strokeLinecap="round" />
  </svg>
);

const IconCards = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="6" width="11" height="14" rx="2" />
    <path d="M9 4h9a2 2 0 0 1 2 2v12" strokeLinecap="round" />
  </svg>
);

const IconAdmin = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5.1 7.5-9.5V6L12 3Z" strokeLinejoin="round" />
    <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconJoin = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 19a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" strokeLinecap="round" />
  </svg>
);

const IconSettings = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-2" aria-hidden="true"><path d="M14 17H5"></path><path d="M19 7h-9"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>
)

/* ----------------------------------- меню ---------------------------------- */

const NAV = [
  { to: '/', label: 'Игра', icon: <IconGame /> },
  { to: '/results', label: 'Итоги', icon: <IconTrophy /> },
  { to: '/deck', label: 'Колода', icon: <IconCards /> },
  // вход участников в тенант по ссылке (/join) — пока не показываем в меню
  // { to: '/join', label: 'Подключиться', icon: <IconJoin /> },
  { to: '/admin', label: 'Администрирование', icon: <IconAdmin /> },
];

/* Пункты меню — как в X-Lance: активный пункт «приподнят» белой плашкой с тонкой рамкой */
const ACTIVE = 'bg-card text-shelltext shadow-[0_0_0_1px_var(--c-line),0_1px_2px_rgba(34,53,75,0.06)]';
const IDLE = 'text-shelltext hover:bg-shelltext/[0.05]';

interface Props {
  /** Вызывается после перехода по ссылке — чтобы закрыть мобильную панель. */
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: Props) {
  const { state } = useSession();

  return (
    <div className="flex h-full flex-col bg-shell text-shelltext">
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pt-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => onNavigate?.()}
            className={({ isActive }) =>
              `mb-0.5 flex h-7 items-center gap-2 rounded-md px-2 text-sm font-medium transition ${
                isActive ? ACTIVE : IDLE
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}

        {state.teamOrder.length > 0 ? (
          <>
            <p className="mb-1 mt-4 flex h-7 items-center px-2 text-xs font-medium text-shellmuted">Команды</p>
            {state.teamOrder.map((id, i) => {
              const p = getProject(id);
              return (
                <NavLink
                  key={id}
                  to={`/team/${id}`}
                  onClick={() => onNavigate?.()}
                  className={({ isActive }) =>
                    `mb-0.5 flex h-7 items-center gap-2 rounded-md px-2 text-sm font-medium transition ${
                      isActive ? ACTIVE : IDLE
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

      <div className="flex justify-center px-5 py-4">
        <XlanceLogo size="xs" />
      </div>
       
    </div>
  );
}

export default Sidebar;
