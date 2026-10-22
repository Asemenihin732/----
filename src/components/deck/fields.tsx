/**
 * Поля форм конфигуратора колоды: подпись + ввод в стиле приложения.
 */
import type { ReactNode } from 'react';

export const inputCls =
  'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-strong outline-none focus:border-brand focus:ring-2 focus:ring-brand/30';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50';
export const btnOutline =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-strong transition hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50';
export const btnSmall =
  'inline-flex items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-1 text-xs font-semibold text-strong transition hover:bg-soft';
export const btnDelete =
  'shrink-0 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-red-500/10 hover:text-red-500';

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-caption font-semibold uppercase tracking-wide text-faint">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  list,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  list?: string;
}) {
  return (
    <input
      className={inputCls}
      value={value}
      placeholder={placeholder}
      list={list}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Число; пустое поле — `undefined` (значения нет). */
export function NumberInput({
  value,
  onChange,
  placeholder,
  step = 1,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      className={inputCls}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: T | '';
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
