import { CharacterBuddy } from './character/CharacterBuddy';

export function FullPageLoader({ label = 'Getting things ready…' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-5" role="status" aria-live="polite">
      <div className="text-center">
        <CharacterBuddy mood="loading" size="md" className="mx-auto" />
        <p className="mt-3 text-sm font-bold text-ink">{label}</p>
        <p className="mt-1 text-xs text-slate-400">Your practice buddy is on it.</p>
      </div>
    </div>
  );
}
