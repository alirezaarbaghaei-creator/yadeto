import { create } from 'zustand';
import type { PageId } from '@/types';

type QuickAddType = 'task' | 'event' | 'picker' | null;

interface AppState {
  currentPage: PageId;
  setPage: (p: PageId) => void;
  quickAddType: QuickAddType;
  openQuickAdd: (type: 'task' | 'event' | 'picker') => void;
  closeQuickAdd: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'home',
  setPage: (p) => set({ currentPage: p }),
  quickAddType: null,
  openQuickAdd: (type) => set({ quickAddType: type }),
  closeQuickAdd: () => set({ quickAddType: null }),
}));
