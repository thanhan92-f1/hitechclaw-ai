import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'error' | 'progress';
  title: string;
  message?: string;
  /** 0-100, only for type='progress' */
  percent?: number;
  /** Auto-dismiss after ms. 0 = manual dismiss only. Default 4000 */
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  updateToast: (id: string, patch: Partial<Omit<Toast, 'id'>>) => void;
  removeToast: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++counter}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));

    const duration = toast.duration ?? (toast.type === 'progress' ? 0 : 4000);
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },

  updateToast: (id, patch) => {
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
