import { create } from 'zustand';
import * as api from '@/lib/api';
import type { AppUser } from '@/lib/api';
import { getItem, setItem, removeItem } from '@/lib/safeStorage';
import { usePlanStore } from '@/store/planStore';
import type { PlanId } from '@/data/plans';

const CACHED_USER_KEY = 'YADETO_cached_user';

function loadCachedUser(): AppUser | null {
  try {
    const raw = getItem(CACHED_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

function saveCachedUser(user: AppUser | null): void {
  try {
    if (user) setItem(CACHED_USER_KEY, JSON.stringify(user));
    else removeItem(CACHED_USER_KEY);
  } catch {
    /* ignore storage errors */
  }
}

interface AuthState {
  session: { access_token: string } | null;
  user: AppUser | null;
  loading: boolean;
  setSession: (token: string, user: AppUser) => void;
  setUser: (user: AppUser) => void;
  updatePlan: (planType: PlanId, aiUsage: number, templateUsage: number) => void;
  setLoading: (v: boolean) => void;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  setSession: (token, user) => {
    saveCachedUser(user);
    set({ session: { access_token: token }, user });
    if (user.id) {
      usePlanStore.getState().refreshFromUser(
        (user.plan_type as PlanId) ?? 'free',
        user.ai_assistant_usage_this_month ?? 0,
        user.template_usage_this_month ?? 0,
      );
      usePlanStore.getState().loadPlan(user.id);
    }
  },

  setUser: (user) => {
    saveCachedUser(user);
    set({ user });
    if (user.id) {
      usePlanStore.getState().refreshFromUser(
        (user.plan_type as PlanId) ?? 'free',
        user.ai_assistant_usage_this_month ?? 0,
        user.template_usage_this_month ?? 0,
      );
    }
  },
  updatePlan: (planType, aiUsage, templateUsage) =>
    set((state) => {
      const updated = state.user
        ? {
            ...state.user,
            plan_type: planType,
            ai_assistant_usage_this_month: aiUsage,
            template_usage_this_month: templateUsage,
          }
        : state.user;
      if (updated) saveCachedUser(updated);
      return { user: updated };
    }),
  setLoading: (v) => set({ loading: v }),
  signOut: async () => {
    await api.signOut();
    saveCachedUser(null);
    usePlanStore.getState().refreshFromUser('free', 0, 0);
    set({ session: null, user: null });
  },
  restoreSession: async () => {
    const token = getItem('YADETO_token');
    if (!token) {
      saveCachedUser(null);
      set({ session: null, user: null, loading: false });
      return;
    }

    // Offline-first: restore immediately from cached user so the app works
    // without requiring internet or re-login.
    const cachedUser = loadCachedUser();
    if (cachedUser) {
      set({ session: { access_token: token }, user: cachedUser, loading: false });
      if (cachedUser.id) {
        usePlanStore.getState().refreshFromUser(
          (cachedUser.plan_type as PlanId) ?? 'free',
          cachedUser.ai_assistant_usage_this_month ?? 0,
          cachedUser.template_usage_this_month ?? 0,
        );
      }
    }

    // If offline, keep the cached session and skip network validation.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!cachedUser) {
        // Token exists even without cachedUser — keep session alive offline
        set({
          session: { access_token: token },
          user: { id: 'local', phone: '', full_name: 'کاربر یادتو', is_admin: false } as AppUser,
          loading: false,
        });
      }
      return;
    }

    // Best-effort background refresh when online
    try {
      const user = await api.getMe();
      if (user) {
        saveCachedUser(user);
        set({ session: { access_token: token }, user, loading: false });
        usePlanStore.getState().refreshFromUser(
          (user.plan_type as PlanId) ?? 'free',
          user.ai_assistant_usage_this_month ?? 0,
          user.template_usage_this_month ?? 0,
        );
        usePlanStore.getState().loadPlan(user.id);
      } else if (!cachedUser) {
        set({ session: null, user: null, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      // Never log the user out on network/offline errors
      if (!cachedUser) {
        set({
          session: { access_token: token },
          user: { id: 'local', phone: '', full_name: 'کاربر یادتو', is_admin: false } as AppUser,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    }
  },
}));
