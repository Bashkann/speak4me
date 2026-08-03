import type { ReactNode } from 'react';
import { CharacterBuddy } from './character/CharacterBuddy';
import type { CharacterMood, CharacterProp } from './character/character-registry';

export function EmptyState({ icon, title, detail, action, compact = false, mood = 'thinking', prop }: { icon: string; title: string; detail: string; action?: ReactNode; compact?: boolean; mood?: CharacterMood; prop?: CharacterProp }) {
  return (
    <div className={`rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 text-center ${compact ? 'py-10' : 'py-16'}`}>
      <div className="relative mx-auto w-fit">
        <CharacterBuddy mood={mood} prop={prop} size={compact ? 'sm' : 'md'} />
        <span aria-hidden="true" className="absolute -right-1 top-0 grid h-8 w-8 place-items-center rounded-xl bg-white text-sm shadow-sm ring-1 ring-brand-100">{icon}</span>
      </div>
      <h2 className="mt-4 font-display text-xl font-extrabold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
