/**
 * Мелкие общие UI-компоненты приложения (Tailwind).
 */
import type { ReactNode } from 'react';

export function StatBox({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="text-xs font-bold text-muted">{label}</div>
      <div className="text-xl font-extrabold text-strong">{value}</div>
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="py-2 text-center text-sm italic text-muted">{children}</p>;
}
