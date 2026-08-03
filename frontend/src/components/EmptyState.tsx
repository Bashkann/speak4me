import type { ReactNode } from 'react';

export function EmptyState({ icon, title, detail, action, compact = false }: { icon: string; title: string; detail: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 text-center ${compact ? 'py-10' : 'py-16'}`}>
      <span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl shadow-sm ring-1 ring-brand-100">{icon}</span>
      <h2 className="mt-4 font-display text-xl font-extrabold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
