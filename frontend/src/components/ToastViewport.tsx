import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore, type ToastTone } from '../store/toast-store';

export function ToastViewport() {
  const items = useToastStore((state) => state.items);
  const remove = useToastStore((state) => state.remove);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-label="Notifications">
      <AnimatePresence initial={false}>
        {items.map((item) => (
        <motion.div key={item.id} initial={{ opacity: 0, x: 24, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 18, scale: 0.96 }} transition={{ duration: 0.2 }} role={item.tone === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-soft ${toneClass(item.tone)}`}>
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold" aria-hidden="true">{toneIcon(item.tone)}</span>
          <p className="flex-1 text-sm font-semibold leading-5 text-slate-700">{item.message}</p>
          <button type="button" onClick={() => remove(item.id)} className="text-lg leading-none text-slate-400 hover:text-ink" aria-label="Dismiss notification">×</button>
        </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function toneClass(tone: ToastTone): string {
  return { info: 'border-slate-200', success: 'border-brand-200', warning: 'border-amber-200', error: 'border-red-200' }[tone];
}

function toneIcon(tone: ToastTone): string {
  return { info: 'i', success: '✓', warning: '!', error: '×' }[tone];
}
