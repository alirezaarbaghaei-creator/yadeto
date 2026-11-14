import { create } from 'zustand';
import type { PageId } from '@/types';

interface AppState {
  currentPage: PageId;
  setPage: (p: PageId) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'home',
  setPage: (p) => set({ currentPage: p }),
}));
