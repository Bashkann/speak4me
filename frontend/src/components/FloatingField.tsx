import { AnimatePresence, motion } from 'framer-motion';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface FloatingFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'placeholder'> {
  label: string;
  error?: string;
  endAdornment?: ReactNode;
}

export function FloatingField({ label, error, endAdornment, id, ...props }: FloatingFieldProps) {
  return (
    <div>
      <div className="relative">
        <input
          {...props}
          id={id}
          placeholder=" "
          aria-invalid={Boolean(error)}
          aria-describedby={error && id ? `${id}-error` : undefined}
          className={`peer field min-h-[3.35rem] pb-2 pt-5 ${endAdornment ? 'pr-20' : ''} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
        />
        <label htmlFor={id} className="pointer-events-none absolute left-3.5 top-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 transition-[transform,color] duration-150 peer-placeholder-shown:translate-y-2.5 peer-placeholder-shown:scale-[1.18] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:translate-y-0 peer-focus:scale-100 peer-focus:uppercase peer-focus:tracking-[0.08em] peer-focus:text-brand-700">
          {label}
        </label>
        {endAdornment && <div className="absolute inset-y-0 right-2 flex items-center">{endAdornment}</div>}
      </div>
      <div className="min-h-5 pt-1">
        <AnimatePresence initial={false}>
          {error && <motion.p id={id ? `${id}-error` : undefined} role="alert" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="text-xs font-semibold text-red-600">{error}</motion.p>}
        </AnimatePresence>
      </div>
    </div>
  );
}
