import { create } from 'zustand';
import api from '@/lib/api';

interface AuthState {
  user: any | null;
  token: string | null;
  login: (data: any) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (data: any) => {
    const res = await api.post('/auth/login', data);
    const { token, user } = res.data;
    localStorage.setItem('smart_prod_token', token);
    localStorage.setItem('smart_prod_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('smart_prod_token');
    localStorage.removeItem('smart_prod_user');
    set({ token: null, user: null });
  },
  checkAuth: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('smart_prod_token');
    const user = localStorage.getItem('smart_prod_user');
    if (token && user) {
      set({ token, user: JSON.parse(user) });
    }
  }
}));
