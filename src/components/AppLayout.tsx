/**
 * Каркас приложения: боковое меню (Sidebar), верхняя панель (Navbar)
 * и основная область контента. Tailwind v4, тема — через [data-mode] на <html>.
 */
import { useState, type ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  // Окно не прокручивается целиком: сайдбар и навбар стоят на месте,
  // прокручивается только область контента (main) или блоки внутри неё.
  return (
    <div className="flex h-dvh overflow-hidden bg-canvas print:h-auto print:overflow-visible text-strong">
      <aside className="no-print hidden h-full w-sidebar shrink-0 md:block">
        <Sidebar onNavigate={closeMobile} />
      </aside>

      {mobileOpen ? (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Закрыть меню"
            className="absolute inset-0 bg-black/50"
            onClick={closeMobile}
          />
          <div className="absolute left-0 top-0 h-full w-sidebar shadow-2xl">
            <Sidebar onNavigate={closeMobile} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-shell">
        <Navbar onOpenMenu={() => setMobileOpen(true)} />
        <main className="mb-2 flex min-h-0 flex-1 flex-col mr-2 overflow-y-auto rounded-2xl bg-card px-[var(--ui-page-padding-x)] py-[var(--ui-page-padding-y)] print:overflow-visible">
          <div className="mx-auto flex min-h-0 w-full max-w-content flex-1 flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
