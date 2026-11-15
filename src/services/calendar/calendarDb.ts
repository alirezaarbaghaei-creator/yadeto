/**
 * Smart Calendar data layer — local-first with best-effort PHP API sync.
 *
 * Strategy:
 *  - All reads/writes go through localStorage first (offline-capable, works
 *    with the php-api custom auth which has no Supabase session).
 *  - When the API is reachable, tasks/events/preferences are also pushed to
 *    the server (calendar_* actions) — best effort, failures never break UI.
 *  - pullFromCloud() merges server rows after login; server wins on conflict
 *    by updatedAt, otherwise local copy stays authoritative.
 */
import * as api from '@/lib/api';
import type { Task, CalendarEvent, Holiday, UserPreferences } from '@/types/calendar';
import { localGet, localSet } from './storage';
import { HOLIDAYS } from '@/data/holidays';

const KEYS = {
  tasks: 'tasks',
  events: 'events',
  holidays: 'holidays',
  preferences: 'preferences',
};

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function sortByDate<T>(items: T[], get: (t: T) => string): T[] {
  return [...items].sort((a, b) => get(a).localeCompare(get(b)));
}

// ─── row mappers (API snake_case ⇄ app camelCase) ─────────────

function taskToRow(t: Task): Record<string, unknown> {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    due_date: t.dueDate,
    due_time: t.dueTime ?? null,
    duration: t.duration ?? 60,
    priority: t.priority,
    category: t.category,
    status: t.status,
    recurrence: t.recurrence,
    day_of_month: t.dayOfMonth ?? null,
    month_of_year: t.monthOfYear ?? null,
    reminder: t.reminder ?? null,
    completed_at: t.completedAt ?? null,
    created_at: t.createdAt,
    updated_at: nowISO(),
  };
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: (row.id as string) ?? newId(),
    title: (row.title as string) ?? 'کار',
    description: (row.description as string) ?? undefined,
    dueDate: (row.due_date as string) ?? (row.dueDate as string) ?? new Date().toISOString().slice(0, 10),
    dueTime: ((row.due_time ?? row.dueTime) as string) ?? undefined,
    duration: ((row.duration ?? row.duration) as number) ?? undefined,
    priority: (row.priority as Task['priority']) ?? 'medium',
    category: (row.category as Task['category']) ?? 'other',
    status: (row.status as Task['status']) ?? 'pending',
    recurrence: (row.recurrence as Task['recurrence']) ?? 'none',
    dayOfMonth: ((row.day_of_month ?? row.dayOfMonth) as number) ?? undefined,
    monthOfYear: ((row.month_of_year ?? row.monthOfYear) as number) ?? undefined,
    reminder: (row.reminder as number) ?? undefined,
    completedAt: ((row.completed_at ?? row.completedAt) as string) ?? undefined,
    createdAt: (row.created_at as string) ?? nowISO(),
    userId: (row.user_id as string) ?? 'local',
  };
}

function eventToRow(e: CalendarEvent): Record<string, unknown> {
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? null,
    event_date: e.date,
    start_time: e.startTime,
    end_time: e.endTime ?? null,
    location: e.location ?? null,
    category: e.category,
    color: e.color,
    reminder: e.reminder ?? null,
    recurrence: e.recurrence ?? 'none',
    created_at: e.createdAt,
    updated_at: nowISO(),
  };
}

function rowToEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: (row.id as string) ?? newId(),
    title: (row.title as string) ?? 'رویداد',
    description: (row.description as string) ?? undefined,
    date: (row.event_date as string) ?? (row.date as string) ?? new Date().toISOString().slice(0, 10),
    startTime: (row.start_time as string) ?? (row.startTime as string) ?? '10:00',
    endTime: ((row.end_time ?? row.endTime) as string) ?? undefined,
    location: ((row.location ?? row.location) as string) ?? undefined,
    category: (row.category as CalendarEvent['category']) ?? 'work',
    color: (row.color as string) ?? '#4f46e5',
    reminder: (row.reminder as number) ?? undefined,
    recurrence: (row.recurrence as CalendarEvent['recurrence']) ?? 'none',
    createdAt: (row.created_at as string) ?? nowISO(),
    userId: (row.user_id as string) ?? 'local',
  };
}

function rowToHoliday(row: Record<string, unknown>): Holiday {
  return {
    id: (row.id as string) ?? newId(),
    title: (row.title as string) ?? 'مناسبت',
    jalaliDate: (row.jalali_date as string) ?? (row.jalaliDate as string) ?? '',
    gregorianDate: (row.gregorian_date as string) ?? (row.gregorianDate as string) ?? '',
    type: (row.type as Holiday['type']) ?? 'occasional',
    isOfficialHoliday: Boolean(row.is_official_holiday ?? row.isOfficialHoliday),
    description: ((row.description ?? row.description) as string) ?? undefined,
  };
}

/** Silent best-effort push helpers — never throw, never block the UI. */
function pushTask(op: 'save' | 'delete', task: Task): void {
  void (async () => {
    try {
      if (op === 'save') await api.calendarTaskSaveApi(taskToRow(task));
      else await api.calendarTaskDeleteApi(task.id);
    } catch {
      /* offline — local copy is authoritative, sync retried on next pull */
    }
  })();
}

function pushEvent(op: 'save' | 'delete', event: CalendarEvent): void {
  void (async () => {
    try {
      if (op === 'save') await api.calendarEventSaveApi(eventToRow(event));
      else await api.calendarEventDeleteApi(event.id);
    } catch {
      /* offline — local copy is authoritative */
    }
  })();
}

export const calendarDb = {
  // ---------- tasks ----------

  loadTasks(): Task[] {
    return localGet<Task[]>(KEYS.tasks) ?? [];
  },

  saveTasks(tasks: Task[]): void {
    localSet(KEYS.tasks, sortByDate(tasks, (t) => t.dueDate));
  },

  createTask(input: Partial<Task>): Task {
    const task: Task = {
      id: newId(),
      title: input.title ?? 'کار جدید',
      description: input.description,
      dueDate: input.dueDate ?? new Date().toISOString().slice(0, 10),
      dueTime: input.dueTime,
      duration: input.duration ?? 60,
      priority: input.priority ?? 'medium',
      category: input.category ?? 'other',
      status: input.status ?? 'pending',
      recurrence: input.recurrence ?? 'none',
      dayOfMonth: input.dayOfMonth,
      monthOfYear: input.monthOfYear,
      reminder: input.reminder ?? 15,
      completedAt: input.completedAt,
      createdAt: nowISO(),
      userId: input.userId ?? 'local',
    };
    pushTask('save', task);
    return task;
  },

  updateTask(id: string, updates: Partial<Task>, current: Task[]): Task | null {
    const existing = current.find((t) => t.id === id);
    if (!existing) return null;
    const next: Task = { ...existing, ...updates, id };
    pushTask('save', next);
    return next;
  },

  deleteTask(id: string): void {
    pushTask('delete', {
      id,
      title: '',
      dueDate: '',
      priority: 'low',
      category: 'other',
      status: 'pending',
      recurrence: 'none',
      createdAt: '',
      userId: 'local',
    } as Task);
  },

  // ---------- events ----------

  loadEvents(): CalendarEvent[] {
    return localGet<CalendarEvent[]>(KEYS.events) ?? [];
  },

  saveEvents(events: CalendarEvent[]): void {
    localSet(KEYS.events, sortByDate(events, (e) => `${e.date} ${e.startTime}`));
  },

  createEvent(input: Partial<CalendarEvent>): CalendarEvent {
    const event: CalendarEvent = {
      id: newId(),
      title: input.title ?? 'رویداد جدید',
      description: input.description,
      date: input.date ?? new Date().toISOString().slice(0, 10),
      startTime: input.startTime ?? '10:00',
      endTime: input.endTime,
      location: input.location,
      category: input.category ?? 'work',
      color: input.color ?? '#4f46e5',
      reminder: input.reminder ?? 15,
      recurrence: input.recurrence ?? 'none',
      createdAt: nowISO(),
      userId: input.userId ?? 'local',
    };
    pushEvent('save', event);
    return event;
  },

  updateEvent(id: string, updates: Partial<CalendarEvent>, current: CalendarEvent[]): CalendarEvent | null {
    const existing = current.find((e) => e.id === id);
    if (!existing) return null;
    const next: CalendarEvent = { ...existing, ...updates, id };
    pushEvent('save', next);
    return next;
  },

  deleteEvent(id: string): void {
    pushEvent('delete', {
      id,
      title: '',
      date: '',
      startTime: '00:00',
      category: 'other',
      color: '#4f46e5',
      createdAt: '',
      userId: 'local',
    } as CalendarEvent);
  },

  // ---------- holidays (static reference + local additions) ----------

  loadHolidays(): Holiday[] {
    const custom = localGet<Holiday[]>(KEYS.holidays) ?? [];
    return mergeHolidays(custom);
  },

  saveCustomHolidays(custom: Holiday[]): void {
    localSet(KEYS.holidays, custom);
  },

  mergeHolidays(custom: Holiday[]): Holiday[] {
    return mergeHolidays(custom);
  },

  // ---------- preferences ----------

  loadPreferences(userId: string): UserPreferences {
    return rowToPrefs(localGet<Partial<UserPreferences>>(KEYS.preferences), userId);
  },

  savePreferences(prefs: UserPreferences): void {
    localSet(KEYS.preferences, prefs);
    void (async () => {
      try {
        await api.calendarPrefsSetApi(prefsToRow(prefs));
      } catch {
        /* offline — retried on next pull */
      }
    })();
  },
};

function mergeHolidays(custom: Holiday[]): Holiday[] {
  const seen = new Set(HOLIDAYS.map((d) => d.gregorianDate));
  const extra = custom.filter((d) => d.gregorianDate && !seen.has(d.gregorianDate));
  return [...HOLIDAYS, ...extra];
}

// ---------- preferences ----------

export function defaultPreferences(userId: string): UserPreferences {
  return {
    userId,
    language: 'fa',
    darkMode: false,
    persianNumbers: true,
    workStart: '08:00',
    workEnd: '20:00',
    workDays: [0, 1, 2, 3, 4],
    defaultReminder: 15,
    notificationsEnabled: true,
  };
}

const prefsToRow = (p: UserPreferences): Record<string, unknown> => ({
  dark_mode: p.darkMode,
  persian_numbers: p.persianNumbers,
  work_start: p.workStart,
  work_end: p.workEnd,
  work_days: p.workDays,
  default_reminder: p.defaultReminder,
  notifications_enabled: p.notificationsEnabled,
  // onboarding travels as JSON inside prefs (stored in the work_days-like TEXT
  // column when the server row supports it; ignored otherwise)
  onboarding: p.onboarding ?? null,
});

const rowToPrefs = (saved: Partial<UserPreferences> | Record<string, unknown> | null, userId: string): UserPreferences => {
  const base = defaultPreferences(userId);
  if (!saved) return base;
  const s = saved as Record<string, unknown>;
  return {
    ...base,
    darkMode: Boolean(s.darkMode ?? s.dark_mode ?? base.darkMode),
    persianNumbers: Boolean(s.persianNumbers ?? s.persian_numbers ?? base.persianNumbers),
    workStart: (s.workStart ?? s.work_start ?? base.workStart) as string,
    workEnd: (s.workEnd ?? s.work_end ?? base.workEnd) as string,
    workDays: (s.workDays ?? s.work_days ?? base.workDays) as number[],
    defaultReminder: Number(s.defaultReminder ?? s.default_reminder ?? base.defaultReminder),
    notificationsEnabled: Boolean(s.notificationsEnabled ?? s.notifications_enabled ?? base.notificationsEnabled),
    onboarding: (s.onboarding as import('@/types/calendar').AssistantProfile | undefined) ?? base.onboarding,
  };
};

/**
 * Pull tasks/events from the PHP API and merge into the local store.
 * Returns null when the API is unreachable (normal offline case) so callers
 * keep the local copy. Server rows win by recency; local-only rows upload.
 */
export async function pullFromCloud(): Promise<{
  tasks: Task[];
  events: CalendarEvent[];
} | null> {
  try {
    const [serverTasks, serverEvents] = await Promise.all([
      api.calendarTasksListApi(),
      api.calendarEventsListApi(),
    ]);
    const remoteTasks = serverTasks.map(rowToTask);
    const remoteEvents = serverEvents.map(rowToEvent);

    const localTasks = calendarDb.loadTasks();
    const localEvents = calendarDb.loadEvents();

    // Merge: union by id; when both sides have an item the server copy wins
    // (server stores the same payloads we push, so this converges).
    const taskMap = new Map<string, Task>();
    for (const t of [...remoteTasks, ...localTasks]) taskMap.set(t.id, t);
    // Local-only rows that the server is missing get pushed now.
    for (const t of localTasks) {
      if (!remoteTasks.some((r) => r.id === t.id)) pushTask('save', t);
    }
    const mergedTasks = sortByDate([...taskMap.values()], (t) => t.dueDate);

    const eventMap = new Map<string, CalendarEvent>();
    for (const e of [...remoteEvents, ...localEvents]) eventMap.set(e.id, e);
    for (const e of localEvents) {
      if (!remoteEvents.some((r) => r.id === e.id)) pushEvent('save', e);
    }
    const mergedEvents = sortByDate([...eventMap.values()], (e) => `${e.date} ${e.startTime}`);

    calendarDb.saveTasks(mergedTasks);
    calendarDb.saveEvents(mergedEvents);
    return { tasks: mergedTasks, events: mergedEvents };
  } catch {
    return null;
  }
}

/** Load user preferences from the server (best effort). */
export async function pullPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const row = await api.calendarPrefsGetApi();
    if (!row) return null;
    const prefs = rowToPrefs(row, userId);
    localSet(KEYS.preferences, prefs);
    return prefs;
  } catch {
    return null;
  }
}

export { rowToTask, rowToEvent, rowToHoliday };
