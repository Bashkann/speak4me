import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  items: ToastMessage[];
  add: (tone: ToastTone, message: string) => string;
  remove: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  add: (tone, message) => {
    const id = crypto.randomUUID();
    set((state) => ({ items: [...state.items, { id, tone, message }].slice(-4) }));
    window.setTimeout(() => get().remove(id), 5_000);
    return id;
  },
  remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  clear: () => set({ items: [] }),
}));
