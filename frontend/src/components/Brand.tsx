import { Link } from 'react-router-dom';

export function Brand({ linked = true }: { linked?: boolean }) {
  const content = (
    <span className="inline-flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight text-ink">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25">
          <path d="M8 9v6M12 6v12M16 9v6M5 12h14" strokeLinecap="round" />
        </svg>
      </span>
      Speak Four
    </span>
  );
  return linked ? <Link to="/">{content}</Link> : content;
}
