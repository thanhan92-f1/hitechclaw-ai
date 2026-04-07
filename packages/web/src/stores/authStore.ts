import { create } from 'zustand';

interface User {
  sub: string;
  email: string;
  role: string;
  name?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('hitechclaw_token'),
  loading: true,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('hitechclaw_token', token);
    } else {
      localStorage.removeItem('hitechclaw_token');
    }
    set({ token });
  },
  setLoading: (loading) => set({ loading }),
  logout: () => {
    localStorage.removeItem('hitechclaw_token');
    set({ user: null, token: null });
  },
}));
