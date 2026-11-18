import { create } from 'zustand';
import type { PageId } from '@/types';

type QuickAddType = 'task' | 'event' | 'picker' | null;

interface AppState {
  currentPage: PageId;
  setPage: (p: PageId) => void;
  quickAddType: QuickAddType;
  openQuickAdd: (type: 'task' | 'event' | 'picker') => void;
  closeQuickAdd: () => void;
  pendingAiPrompt: string | null;
  setPendingAiPrompt: (prompt: string | null) => void;
  launchAiPrompt: (prompt: string) => void;
  consumePendingAiPrompt: () => string | null;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'home',
  setPage: (p) => set({ currentPage: p }),
  quickAddType: null,
  openQuickAdd: (type) => set({ quickAddType: type }),
  closeQuickAdd: () => set({ quickAddType: null }),
  pendingAiPrompt: null,
  setPendingAiPrompt: (prompt) => set({ pendingAiPrompt: prompt }),
  launchAiPrompt: (prompt) => set({ pendingAiPrompt: prompt, currentPage: 'assistant' }),
  consumePendingAiPrompt: () => {
    const prompt = get().pendingAiPrompt;
    if (prompt) set({ pendingAiPrompt: null });
    return prompt;
  },
}));
