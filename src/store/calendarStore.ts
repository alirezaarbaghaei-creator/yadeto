/**
 * Smart Calendar store — local-first data with best-effort PHP API sync.
 * Drives all calendar pages (home / calendar / tasks / assistant / more).
 */
import { create } from 'zustand';
import { useAuthStore } from './authStore';
import type { Task, CalendarEvent, Holiday, UserPreferences } from '@/types/calendar';
import { calendarDb, pullFromCloud, pullPreferences } from '@/services/calendar/calendarDb';
import { getTodayISO } from '@/utils/jalaliDate';

interface CalendarState {
  loaded: boolean;
  loading: boolean;
  tasks: Task[];
  events: CalendarEvent[];
  holidays: Holiday[];
  preferences: UserPreferences | null;

  refresh: () => Promise<void>;
  addTask: (task: Partial<Task>) => Task | null;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  skipTask: (id: string) => void;

  addEvent: (event: Partial<CalendarEvent>) => CalendarEvent | null;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;

  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  loaded: false,
  loading: false,
  tasks: calendarDb.loadTasks(),
  events: calendarDb.loadEvents(),
  holidays: calendarDb.loadHolidays(),
  preferences: null,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const user = useAuthStore.getState().user;
      const localPrefs = calendarDb.loadPreferences('local');

      // Best-effort server pull (no-op / null while offline)
      const [cloud, serverPrefs] = await Promise.all([
        pullFromCloud(),
        pullPreferences(user?.id ?? 'local'),
      ]);

      set({
        tasks: cloud?.tasks ?? calendarDb.loadTasks(),
        events: cloud?.events ?? calendarDb.loadEvents(),
        holidays: calendarDb.loadHolidays(),
        preferences: serverPrefs ?? localPrefs,
        loaded: true,
        loading: false,
      });
    } catch (err) {
      console.warn('[SmartCalendar] refresh error', err);
      set({
        tasks: calendarDb.loadTasks(),
        events: calendarDb.loadEvents(),
        holidays: calendarDb.loadHolidays(),
        preferences: calendarDb.loadPreferences('local'),
        loaded: true,
        loading: false,
      });
    }
  },

  addTask: (input) => {
    const task = calendarDb.createTask({
      ...input,
      userId: get().preferences?.userId ?? 'local',
    });
    const tasks = [...get().tasks, task].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    calendarDb.saveTasks(tasks);
    set({ tasks });
    return task;
  },

  updateTask: (id, updates) => {
    const updated = calendarDb.updateTask(id, updates, get().tasks);
    if (!updated) return;
    const tasks = get().tasks.map((t) => (t.id === id ? updated : t));
    calendarDb.saveTasks(tasks);
    set({ tasks });
  },

  deleteTask: (id) => {
    calendarDb.deleteTask(id);
    const tasks = get().tasks.filter((t) => t.id !== id);
    calendarDb.saveTasks(tasks);
    set({ tasks });
  },

  toggleTask: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const completed = task.status === 'completed';
    get().updateTask(id, {
      status: completed ? 'pending' : 'completed',
      completedAt: completed ? undefined : new Date().toISOString(),
    });
  },

  skipTask: (id) => {
    get().updateTask(id, { status: 'skipped' });
  },

  addEvent: (input) => {
    const event = calendarDb.createEvent({
      ...input,
      userId: get().preferences?.userId ?? 'local',
    });
    const events = [...get().events, event].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    calendarDb.saveEvents(events);
    set({ events });
    return event;
  },

  updateEvent: (id, updates) => {
    const updated = calendarDb.updateEvent(id, updates, get().events);
    if (!updated) return;
    const events = get().events.map((e) => (e.id === id ? updated : e));
    calendarDb.saveEvents(events);
    set({ events });
  },

  deleteEvent: (id) => {
    calendarDb.deleteEvent(id);
    const events = get().events.filter((e) => e.id !== id);
    calendarDb.saveEvents(events);
    set({ events });
  },

  updatePreferences: (prefs) => {
    const current = get().preferences ?? calendarDb.loadPreferences('local');
    const next = { ...current, ...prefs };
    calendarDb.savePreferences(next);
    set({ preferences: next });
  },
}));

/** Convenience selectors used by the pages */
export const selectTodayPendingTasks = (s: CalendarState): Task[] => {
  const today = getTodayISO();
  return s.tasks.filter((t) => t.dueDate === today && t.status === 'pending');
};
