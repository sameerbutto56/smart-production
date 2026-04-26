import { create } from 'zustand';
import api from '@/lib/api';

interface OrderState {
  orders: any[];
  isLoading: boolean;
  fetchOrders: () => Promise<void>;
  updateOrderStage: (id: string, data: any) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  isLoading: false,
  fetchOrders: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/orders');
      set({ orders: res.data, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
    }
  },
  updateOrderStage: async (id, data) => {
    await api.patch('/orders/stage', { id, ...data });
    get().fetchOrders(); // Refresh after update
  }
}));
