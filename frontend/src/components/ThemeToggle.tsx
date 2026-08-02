import { motion } from 'framer-motion';
import { resolvedTheme, useThemeStore } from '../store/theme-store';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const mode = useThemeStore((state) => state.mode);
  const toggle = useThemeStore((state) => state.toggle);
  const dark = resolvedTheme(mode) === 'dark';
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={toggle}
      className={`inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand-300 hover:text-brand-700 ${compact ? 'h-10 w-10' : 'gap-2 px-3 py-2 text-sm font-bold'}`}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
    >
      <span aria-hidden="true">{dark ? '☀︎' : '◐'}</span>
      {!compact && <span>{dark ? 'Light' : 'Dark'}</span>}
    </motion.button>
  );
}
