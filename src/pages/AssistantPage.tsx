import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send,
  Sparkles,
  Check,
  X,
  CalendarClock,
  MapPin,
  Brain,
  Zap,
  RotateCcw,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  AlertTriangle,
  Clock,
  CalendarDays,
  ListTodo,
  Coffee,
  Repeat,
  Tag,
  WifiOff,
  Moon,
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useCalendarStore } from '@/store/calendarStore';
import { usePlanStore } from '@/store/planStore';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { getItem as getStoredItem, setItem as setStoredItem } from '@/lib/safeStorage';
import { callLLM, isLLMError, type ClarifyData } from '@/services/calendar/calendarLlm';
import { calendarAi } from '@/services/calendar/calendarAi';
import {
  findFreeSlots,
  getVisibleTasksForDate,
  getTodaySchedule,
  formatFreeTime,
} from '@/services/calendar/schedulingEngine';
import { scheduleTaskReminder } from '@/services/calendar/notifications';
import type { AIIntent, Priority, RecurrenceType, TaskCategory } from '@/types/calendar';
import {
  getTodayJalali,
  formatJalali,
  getTodayISO,
  toFaDigits,
  parseJalali,
  dateToJalali,
  toGregorian,
  gregorianToISO,
  getStartOfWeek,
  getEndOfWeek,
} from '@/utils/jalaliDate';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intentData?: Record<string, unknown> | null;
  actions?: { label: string; type: 'confirm' | 'cancel' }[];
  clarify?: ClarifyData | null;
  offlineFallback?: boolean;
}

let messageCounter = Date.now();
const nextId = () => `msg-${messageCounter++}`;

const CHAT_KEY = 'assistant_chat_v1';

interface StoredChat {
  messages: ChatMessage[];
}

function loadStoredMessages(): ChatMessage[] {
  try {
    const raw = getStoredItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredChat;
    return Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]): void {
  try {
    setStoredItem(CHAT_KEY, JSON.stringify({ messages } as StoredChat));
  } catch {
    /* storage full / unavailable — chat stays in memory only */
  }
}

function intentDateToISO(dateStr: string): string | null {
  const parsed = parseJalali(dateStr);
  if (!parsed) {
    return /^\d{4}-\d{2}-\d{2}/.test(dateStr) ? dateStr.slice(0, 10) : null;
  }
  return gregorianToISO(toGregorian(parsed.year, parsed.month, parsed.day));
}

function formatISOToJalaliLong(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const parsed = parseJalali(iso);
    return parsed ? formatJalali(parsed, 'long') : iso;
  }
  return formatJalali(dateToJalali(new Date(iso.slice(0, 10) + 'T00:00:00')), 'long');
}

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  work: '#3157D5',
  personal: '#13A89E',
  health: '#22C55E',
  finance: '#F59E0B',
  education: '#8B5CF6',
  social: '#EC4899',
  other: '#64748B',
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  work: 'کاری',
  personal: 'شخصی',
  health: 'سلامت',
  finance: 'مالی',
  education: 'آموزش',
  social: 'اجتماعی',
  other: 'سایر',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'مهم',
  medium: 'متوسط',
  low: 'کم',
};

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
  yearly: 'سالانه',
};

const ACTION_LABELS: Record<string, string> = {
  create_task: 'کار جدید',
  create_recurring_task: 'کار تکرارشونده',
  create_event: 'رویداد جدید',
  reschedule_task: 'جابه‌جایی کار',
  reschedule_event: 'جابه‌جایی رویداد',
  delete_task: 'حذف کار',
  delete_event: 'حذف رویداد',
};

function buildGreeting(): string {
  return `سلام! من «یادتو» هستم — مدیر برنامه هوشمند تو.

می‌تونی بنویسی یا با میکروفون صحبت کنی تا برات انجام بدم:
• ثبت کار و رویداد با اولویت، مکان و یادآوری («فردا ساعت ۱۰ جلسه با تیم فنی دارم»)
• اولویت‌بندی کارها و چیدمان برنامه امروز بر اساس ساعت‌های خالی
• تشخیص تداخل زمانی قبل از ثبت رویدادها
• کارهای تکرارشونده (قسط ماهانه، کلاس هفتگی، ورزش روزانه)
• پیدا کردن زمان آزاد و پیشنهاد بهترین تاریخ برای سفر

از نوار وضعیت بالا یا پیشنهادهای زیر شروع کن، یا هرچی تو ذهنت هست بگو.`;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AssistantPage() {
  const tasks = useCalendarStore((s) => s.tasks);
  const events = useCalendarStore((s) => s.events);
  const notes = useCalendarStore((s) => s.notes);
  const holidays = useCalendarStore((s) => s.holidays);
  const preferences = useCalendarStore((s) => s.preferences);
  const addTask = useCalendarStore((s) => s.addTask);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const addNote = useCalendarStore((s) => s.addNote);
  const updateNote = useCalendarStore((s) => s.updateNote);
  const deleteNote = useCalendarStore((s) => s.deleteNote);
  const toggleTask = useCalendarStore((s) => s.toggleTask);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const updateTask = useCalendarStore((s) => s.updateTask);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const updatePreferences = useCalendarStore((s) => s.updatePreferences);
  const user = useAuthStore((s) => s.user);
  const canUseAiAssistant = usePlanStore((s) => s.canUseAiAssistant);
  const incrementAiAssistant = usePlanStore((s) => s.incrementAiAssistant);
  const canUseTemplate = usePlanStore((s) => s.canUseTemplate);
  const incrementTemplate = usePlanStore((s) => s.incrementTemplate);
  const openUpgradeModal = usePlanStore((s) => s.openUpgradeModal);
  const consumePendingAiPrompt = useAppStore((s) => s.consumePendingAiPrompt);
  const isOnline = useOnlineStatus();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = loadStoredMessages();
    if (stored.length > 0) return stored;
    return [{ id: '0', role: 'assistant', content: buildGreeting() }];
  });
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceReplyRef = useRef(false);

  // Live Program Manager Snapshot
  const todayISO = getTodayISO();
  const visibleToday = useMemo(() => getVisibleTasksForDate(tasks, todayISO), [tasks, todayISO]);
  const todayPendingCount = useMemo(
    () => visibleToday.filter((t) => t.status === 'pending').length,
    [visibleToday],
  );
  const todayEventsCount = useMemo(
    () => events.filter((e) => e.date === todayISO).length,
    [events, todayISO],
  );
  const overdueCount = useMemo(
    () => tasks.filter((t) => t.status === 'pending' && t.dueDate < todayISO).length,
    [tasks, todayISO],
  );
  const todaySchedule = useMemo(
    () =>
      getTodaySchedule(
        events,
        visibleToday,
        preferences?.workStart ?? '08:00',
        preferences?.workEnd ?? '20:00',
      ),
    [events, visibleToday, preferences],
  );

  useEffect(() => {
    voiceReplyRef.current = voiceReplyEnabled;
  }, [voiceReplyEnabled]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const speakText = useCallback((text: string) => {
    if (!voiceReplyRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[•*#✓]/g, ' '));
      utterance.lang = 'fa-IR';
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      /* ignore TTS errors on unsupported devices */
    }
  }, []);

  const lastSpokenIdRef = useRef<string | null>(messages[messages.length - 1]?.id ?? null);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && last.id !== lastSpokenIdRef.current) {
      lastSpokenIdRef.current = last.id;
      speakText(last.content);
    }
  }, [messages, speakText]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const pushMessage = useCallback((m: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => {
      const next = [...prev, { ...m, id: nextId() }];
      saveMessages(next);
      return next;
    });
  }, []);

  const clearActions = useCallback(() => {
    setMessages((prev) => {
      const next = prev.map((m) => (m.actions?.length ? { ...m, actions: [] } : m));
      saveMessages(next);
      return next;
    });
  }, []);

  const detectConflict = useCallback(
    (isoDate: string, timeStr?: string): string | null => {
      if (!isoDate || !timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      const targetMin = h * 60 + m;

      for (const e of events) {
        if (e.date !== isoDate) continue;
        const [eh, em] = e.startTime.split(':').map(Number);
        const start = eh * 60 + em;
        const end = e.endTime
          ? (() => {
              const [xh, xm] = e.endTime.split(':').map(Number);
              return xh * 60 + xm;
            })()
          : start + 60;
        if (targetMin >= start && targetMin < end) {
          return `تداخل با رویداد «${e.title}» (${toFaDigits(e.startTime)})`;
        }
      }

      for (const t of tasks) {
        if (t.dueDate !== isoDate || t.status !== 'pending' || !t.dueTime) continue;
        const [th, tm] = t.dueTime.split(':').map(Number);
        const start = th * 60 + tm;
        const end = start + (t.duration || 60);
        if (targetMin >= start && targetMin < end) {
          return `تداخل با کار «${t.title}» (${toFaDigits(t.dueTime)})`;
        }
      }

      return null;
    },
    [events, tasks],
  );

  const handleConfirm = useCallback(
    async (intentData: Record<string, unknown>) => {
      const action = intentData.action as string;

      if (action === 'create_task' || action === 'create_recurring_task' || action === 'create_event') {
        if (!canUseTemplate()) {
          openUpgradeModal('no-template-credits');
          pushMessage({
            role: 'assistant',
            content: 'سهمیه ثبت کار و رویداد امروزت تمام شده. با ارتقای طرح می‌تونی نامحدود ثبت کنی.',
          });
          return;
        }
      }

      if (action === 'create_task' || action === 'create_recurring_task') {
        const title = (intentData.title as string) || 'کار';
        const dateStr = (intentData.date as string) || formatJalali(getTodayJalali(), 'short');
        const iso = intentDateToISO(dateStr);
        if (!iso) {
          pushMessage({ role: 'assistant', content: 'تاریخ رو نتونستم بفهمم. لطفاً دوباره بگو.' });
          return;
        }
        const time = (intentData.time as string) || (intentData.startTime as string) || undefined;
        const priority = (['low', 'medium', 'high'].includes(intentData.priority as string)
          ? intentData.priority
          : 'medium') as Priority;
        const category = (['work', 'personal', 'health', 'finance', 'education', 'social', 'other'].includes(
          intentData.category as string,
        )
          ? intentData.category
          : 'personal') as TaskCategory;
        const recurrence = (['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(
          intentData.recurrence as string,
        )
          ? intentData.recurrence
          : 'none') as RecurrenceType;
        const reminder = typeof intentData.reminder === 'number' ? intentData.reminder : preferences?.defaultReminder ?? 15;
        const dayOfMonth = typeof intentData.day_of_month === 'number' ? intentData.day_of_month : undefined;

        const task = addTask({
          title,
          dueDate: iso,
          dueTime: time,
          duration: typeof intentData.duration === 'number' ? intentData.duration : undefined,
          priority,
          category,
          status: 'pending',
          recurrence,
          dayOfMonth,
          reminder,
        });
        if (task && task.dueTime) {
          await scheduleTaskReminder(task.title, task.dueDate, task.dueTime, reminder);
        }
        void incrementTemplate(user?.id ?? 'local');
        pushMessage({
          role: 'assistant',
          content: `✓ کار «${title}» برای ${formatISOToJalaliLong(iso)}${
            time ? ` ساعت ${toFaDigits(time)}` : ''
          } ثبت شد.${task.dueTime ? ` ${toFaDigits(reminder)} دقیقه قبل یادآوری می‌کنم.` : ''}`,
        });
        return;
      }

      if (action === 'create_event') {
        const title = (intentData.title as string) || 'رویداد';
        const dateStr = (intentData.date as string) || formatJalali(getTodayJalali(), 'short');
        const iso = intentDateToISO(dateStr);
        if (!iso) {
          pushMessage({ role: 'assistant', content: 'تاریخ رو نتونستم بفهمم. لطفاً دوباره بگو.' });
          return;
        }
        const startTime = (intentData.startTime as string) || (intentData.time as string) || '10:00';
        const endTime = (intentData.endTime as string) || undefined;
        const location = (intentData.location as string) || undefined;
        const category = (['work', 'personal', 'health', 'finance', 'education', 'social', 'other'].includes(
          intentData.category as string,
        )
          ? intentData.category
          : 'work') as TaskCategory;
        const recurrence = (['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(
          intentData.recurrence as string,
        )
          ? intentData.recurrence
          : 'none') as RecurrenceType;
        const reminder = typeof intentData.reminder === 'number' ? intentData.reminder : preferences?.defaultReminder ?? 15;

        const event = addEvent({
          title,
          date: iso,
          startTime,
          endTime,
          location,
          category,
          color: CATEGORY_COLORS[category] || '#4338ca',
          reminder,
          recurrence,
        });
        if (event) {
          await scheduleTaskReminder(event.title, event.date, event.startTime, reminder);
        }
        void incrementTemplate(user?.id ?? 'local');
        pushMessage({
          role: 'assistant',
          content: `✓ رویداد «${title}» برای ${formatISOToJalaliLong(iso)} ساعت ${toFaDigits(startTime)}${
            location ? ` در ${location}` : ''
          } ثبت شد.`,
        });
        return;
      }

      if (action === 'create_note') {
        const title = ((intentData.title as string) || '').trim() || 'یادداشت جدید';
        const content = ((intentData.content as string) || (intentData.description as string) || '').trim();
        const category = (intentData.category as string) || 'عمومی';
        addNote({ title, content, category });
        pushMessage({
          role: 'assistant',
          content: `✓ یادداشت «${title}» با موفقیت ذخیره شد و در بخش یادداشت‌ها قرار گرفت.`,
        });
        return;
      }

      if (action === 'update_note') {
        const id = (intentData.id as string) || '';
        const titleQ = ((intentData.title as string) || '').trim();
        const target = notes.find((n) => n.id === id || (titleQ && n.title.includes(titleQ)));
        if (!target) {
          pushMessage({ role: 'assistant', content: 'یادداشت مورد نظر رو پیدا نکردم.' });
          return;
        }
        const updates: Partial<typeof target> = {};
        if (typeof intentData.title_new === 'string' && intentData.title_new.trim()) {
          updates.title = intentData.title_new.trim();
        }
        if (typeof intentData.content === 'string') {
          updates.content = intentData.content;
        }
        if (typeof intentData.category === 'string') {
          updates.category = intentData.category;
        }
        updateNote(target.id, updates);
        pushMessage({
          role: 'assistant',
          content: `✓ یادداشت «${updates.title || target.title}» به‌روزرسانی شد.`,
        });
        return;
      }

      if (action === 'delete_note') {
        const id = (intentData.id as string) || '';
        const titleQ = ((intentData.title as string) || '').trim();
        const target = notes.find((n) => n.id === id || (titleQ && n.title.includes(titleQ)));
        if (!target) {
          pushMessage({ role: 'assistant', content: 'یادداشت مورد نظر رو برای حذف پیدا نکردم.' });
          return;
        }
        deleteNote(target.id);
        pushMessage({
          role: 'assistant',
          content: `✓ یادداشت «${target.title}» حذف شد.`,
        });
        return;
      }

      if (action === 'delete_task') {
        const id = (intentData.id as string) || '';
        const titleQ = ((intentData.title as string) || '').trim();
        const target = tasks.find(
          (t) => t.id === id || (titleQ && t.title.includes(titleQ)),
        );
        if (!target) {
          pushMessage({ role: 'assistant', content: 'کار مورد نظر رو پیدا نکردم. عنوان دقیق‌تر بگو.' });
          return;
        }
        deleteTask(target.id);
        pushMessage({ role: 'assistant', content: `✓ کار «${target.title}» حذف شد.` });
        return;
      }

      if (action === 'delete_event') {
        const id = (intentData.id as string) || '';
        const titleQ = ((intentData.title as string) || '').trim();
        const target = events.find(
          (e) => e.id === id || (titleQ && e.title.includes(titleQ)),
        );
        if (!target) {
          pushMessage({ role: 'assistant', content: 'رویداد مورد نظر رو پیدا نکردم. عنوان دقیق‌تر بگو.' });
          return;
        }
        deleteEvent(target.id);
        pushMessage({ role: 'assistant', content: `✓ رویداد «${target.title}» حذف شد.` });
        return;
      }

      if (action === 'reschedule_task') {
        const id = (intentData.id as string) || '';
        const titleQ = ((intentData.title as string) || '').trim();
        const target = tasks.find(
          (t) => t.id === id || (titleQ && t.title.includes(titleQ)),
        );
        if (!target) {
          pushMessage({ role: 'assistant', content: 'کار مورد نظر رو پیدا نکردم.' });
          return;
        }
        const dateStr = (intentData.date as string) || target.dueDate;
        const iso = intentDateToISO(dateStr);
        if (!iso) {
          pushMessage({ role: 'assistant', content: 'تاریخ جدید رو نتونستم بفهمم.' });
          return;
        }
        const newTime = (intentData.time as string) || (intentData.startTime as string) || target.dueTime;
        updateTask(target.id, { dueDate: iso, dueTime: newTime });
        pushMessage({
          role: 'assistant',
          content: `✓ «${target.title}» به ${formatISOToJalaliLong(iso)}${newTime ? ` ساعت ${toFaDigits(newTime)}` : ''} منتقل شد.`,
        });
        return;
      }

      if (action === 'reschedule_event' || action === 'update_event') {
        const id = (intentData.id as string) || '';
        const titleQ = ((intentData.title as string) || '').trim();
        const target = events.find(
          (e) => e.id === id || (titleQ && e.title.includes(titleQ)),
        );
        if (!target) {
          pushMessage({ role: 'assistant', content: 'رویداد مورد نظر رو پیدا نکردم.' });
          return;
        }
        const updates: Partial<typeof target> = {};
        if (typeof intentData.title_new === 'string' && intentData.title_new.trim()) {
          updates.title = intentData.title_new.trim();
        }
        if (typeof intentData.description === 'string') {
          updates.description = intentData.description;
        }
        if (typeof intentData.date === 'string') {
          const iso = intentDateToISO(intentData.date);
          if (!iso) {
            pushMessage({ role: 'assistant', content: 'تاریخ جدید رو نتونستم بفهمم.' });
            return;
          }
          updates.date = iso;
        }
        if (typeof intentData.startTime === 'string' || typeof intentData.time === 'string') {
          updates.startTime = (intentData.startTime as string) || (intentData.time as string);
        }
        if (typeof intentData.endTime === 'string') updates.endTime = intentData.endTime;
        if (typeof intentData.location === 'string') updates.location = intentData.location;
        if (typeof intentData.color === 'string') updates.color = intentData.color;
        if (
          ['work', 'personal', 'health', 'finance', 'education', 'social', 'other'].includes(
            intentData.category as string,
          )
        ) {
          updates.category = intentData.category as TaskCategory;
          if (!updates.color) updates.color = CATEGORY_COLORS[updates.category];
        }
        if (typeof intentData.reminder === 'number') updates.reminder = intentData.reminder;
        if (
          ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(intentData.recurrence as string)
        ) {
          updates.recurrence = intentData.recurrence as RecurrenceType;
        }

        updateEvent(target.id, updates);
        const finalDate = updates.date || target.date;
        const finalTime = updates.startTime || target.startTime;
        if (updates.reminder !== -1) {
          await scheduleTaskReminder(
            updates.title || target.title,
            finalDate,
            finalTime,
            updates.reminder ?? target.reminder ?? preferences?.defaultReminder ?? 15,
          );
        }
        pushMessage({
          role: 'assistant',
          content: `✓ رویداد «${updates.title || target.title}» (${formatISOToJalaliLong(finalDate)} ساعت ${toFaDigits(finalTime)}) به‌روزرسانی شد.`,
        });
        return;
      }

      if (action === 'update_task') {
        const id = (intentData.id as string) || '';
        const titleQ = ((intentData.title as string) || '').trim();
        const target =
          tasks.find((t) => t.id === id || (titleQ && t.title.includes(titleQ))) ??
          (titleQ ? undefined : tasks.find((t) => t.status === 'pending'));
        if (!target) {
          pushMessage({ role: 'assistant', content: 'کار مورد نظر رو پیدا نکردم. عنوان دقیق‌تر بگو.' });
          return;
        }
        const updates: Partial<typeof target> = {};
        if (typeof intentData.title_new === 'string' && intentData.title_new.trim()) {
          updates.title = intentData.title_new.trim();
        }
        if (typeof intentData.description === 'string') {
          updates.description = intentData.description;
        }
        if (typeof intentData.date === 'string') {
          const iso = intentDateToISO(intentData.date);
          if (iso) updates.dueDate = iso;
        }
        if (typeof intentData.time === 'string') updates.dueTime = intentData.time;
        if (typeof intentData.duration === 'number') updates.duration = intentData.duration;
        if (['low', 'medium', 'high'].includes(intentData.priority as string)) {
          updates.priority = intentData.priority as Priority;
        }
        if (
          ['work', 'personal', 'health', 'finance', 'education', 'social', 'other'].includes(
            intentData.category as string,
          )
        ) {
          updates.category = intentData.category as TaskCategory;
        }
        if (typeof intentData.reminder === 'number') updates.reminder = intentData.reminder;
        if (
          ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(intentData.recurrence as string)
        ) {
          updates.recurrence = intentData.recurrence as RecurrenceType;
        }

        updateTask(target.id, updates);
        const finalDate = updates.dueDate || target.dueDate;
        const finalTime = updates.dueTime ?? target.dueTime;
        if (finalTime && updates.reminder !== -1) {
          await scheduleTaskReminder(
            updates.title || target.title,
            finalDate,
            finalTime,
            updates.reminder ?? target.reminder ?? preferences?.defaultReminder ?? 15,
          );
        }

        const changes: string[] = [];
        if (updates.priority) changes.push(`اولویت: ${PRIORITY_LABELS[updates.priority]}`);
        if (updates.category) changes.push(`دسته: ${CATEGORY_LABELS[updates.category]}`);
        if (updates.dueTime) changes.push(`ساعت: ${toFaDigits(updates.dueTime)}`);
        if (updates.reminder !== undefined) {
          changes.push(
            updates.reminder < 0
              ? 'بدون یادآوری'
              : `یادآوری: ${toFaDigits(String(updates.reminder))} دقیقه قبل`,
          );
        }
        pushMessage({
          role: 'assistant',
          content: `✓ کار «${updates.title || target.title}» به‌روزرسانی شد${
            changes.length ? ` (${changes.join(' • ')})` : ''
          }.`,
        });
        return;
      }

      if (action === 'complete_task') {
        const id = (intentData.id as string) || '';
        const titleQ = ((intentData.title as string) || '').trim();
        const target =
          tasks.find((t) => t.status === 'pending' && (t.id === id || (titleQ && t.title.includes(titleQ)))) ??
          tasks.find((t) => t.status === 'pending' && (t.dueDate === todayISO || t.dueDate < todayISO));
        if (!target) {
          pushMessage({ role: 'assistant', content: 'کار در جریانی برای علامت‌زدن پیدا نکردم.' });
          return;
        }
        toggleTask(target.id);
        pushMessage({ role: 'assistant', content: `✓ «${target.title}» به‌عنوان انجام‌شده علامت خورد.` });
        return;
      }

      if (action === 'update_work_hours') {
        const workStart = (intentData.workStart as string) || preferences?.workStart || '08:00';
        const workEnd = (intentData.workEnd as string) || preferences?.workEnd || '20:00';
        const defaultReminder =
          typeof intentData.defaultReminder === 'number'
            ? intentData.defaultReminder
            : preferences?.defaultReminder ?? 15;
        updatePreferences({ workStart, workEnd, defaultReminder });
        pushMessage({
          role: 'assistant',
          content: `✓ ساعات کاری شما از ${toFaDigits(workStart)} تا ${toFaDigits(workEnd)} (با یادآوری ${toFaDigits(String(defaultReminder))} دقیقه قبل) تنظیم شد.`,
        });
        return;
      }

      if (action === 'auto_schedule_tasks') {
        const targetISO =
          typeof intentData.date === 'string' ? intentDateToISO(intentData.date) ?? todayISO : todayISO;
        const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
        const unscheduled = tasks
          .filter((t) => t.status === 'pending' && !t.dueTime && t.dueDate <= targetISO)
          .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        if (unscheduled.length === 0) {
          pushMessage({
            role: 'assistant',
            content: 'همه کارهای امروز و عقب‌افتاده‌ها یا ساعت مشخص دارن یا انجام شدن!',
          });
          return;
        }

        const freeResult = findFreeSlots({
          events,
          tasks,
          holidays,
          workStart: preferences?.workStart ?? '08:00',
          workEnd: preferences?.workEnd ?? '20:00',
          workDays: preferences?.workDays ?? [6, 0, 1, 2, 3],
          durationMinutes: 45,
          daysAhead: 2,
        });

        if (freeResult.slots.length === 0) {
          pushMessage({
            role: 'assistant',
            content: 'متأسفانه در دو روز آینده بازه خالی کافی پیدا نشد. می‌تونی ساعات کاریت رو تغییر بدی.',
          });
          return;
        }

        const scheduledLines: string[] = [];
        let slotIdx = 0;
        for (const t of unscheduled) {
          if (slotIdx >= freeResult.slots.length) break;
          const slot = freeResult.slots[slotIdx++];
          updateTask(t.id, { dueDate: slot.date, dueTime: slot.startTime });
          await scheduleTaskReminder(t.title, slot.date, slot.startTime, preferences?.defaultReminder ?? 15);
          scheduledLines.push(
            `• ${t.title} ← ${formatISOToJalaliLong(slot.date)} ساعت ${toFaDigits(slot.startTime)}`,
          );
        }

        pushMessage({
          role: 'assistant',
          content: `✓ ${toFaDigits(String(scheduledLines.length))} کار به‌صورت خودکار در وقت‌های آزاد زمان‌بندی شد:\n\n${scheduledLines.join('\n')}`,
        });
        return;
      }

      if (action === 'batch_actions' && Array.isArray(intentData.items)) {
        for (const item of intentData.items as Record<string, unknown>[]) {
          await handleConfirm(item);
        }
        return;
      }

      pushMessage({ role: 'assistant', content: 'این عملیات هنوز پشتیبانی نمی‌شود.' });
    },
    [
      addTask,
      addEvent,
      deleteTask,
      deleteEvent,
      updateTask,
      updateEvent,
      toggleTask,
      updatePreferences,
      tasks,
      events,
      holidays,
      preferences,
      todayISO,
      pushMessage,
      canUseTemplate,
      incrementTemplate,
      openUpgradeModal,
      user,
    ],
  );

  const buildDayScheduleText = useCallback(
    (isoDate: string): string => {
      const dayEvents = events
        .filter((e) => e.date === isoDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const dayTasks = getVisibleTasksForDate(tasks, isoDate).filter((t) => t.status === 'pending');
      const label = formatISOToJalaliLong(isoDate);

      let text = `برنامه ${label}:\n\n`;
      if (dayEvents.length === 0 && dayTasks.length === 0) {
        text += 'برای این روز برنامه‌ای ثبت نشده — روزت کاملاً آزاده!';
      } else {
        for (const e of dayEvents) {
          text += `• رویداد: ${e.title} — ساعت ${toFaDigits(e.startTime)}${e.location ? ` (${e.location})` : ''}\n`;
        }
        for (const t of dayTasks) {
          text += `• کار: ${t.title}${t.dueTime ? ` — ساعت ${toFaDigits(t.dueTime)}` : ''} [${PRIORITY_LABELS[t.priority]}]\n`;
        }
      }
      return text.trim();
    },
    [events, tasks],
  );

  const handleInfoIntent = useCallback(
    (intent: AIIntent): string | null => {
      switch (intent.action) {
        case 'find_free_time': {
          const duration = (intent.duration as number) || (intent.durationMinutes as number) || 60;
          const result = findFreeSlots({
            events,
            tasks,
            holidays,
            workStart: preferences?.workStart ?? '08:00',
            workEnd: preferences?.workEnd ?? '20:00',
            workDays: preferences?.workDays ?? [6, 0, 1, 2, 3],
            durationMinutes: duration,
          });
          return calendarAi.generateScheduleSuggestion(result.slots, 'کار پیشنهادی');
        }
        case 'show_today':
          return buildDayScheduleText(getTodayISO());
        case 'show_day': {
          const rawDate = (intent.date as string) || getTodayISO();
          const iso = intentDateToISO(rawDate) ?? getTodayISO();
          return buildDayScheduleText(iso);
        }
        case 'summarize_week': {
          const start = getStartOfWeek(getTodayJalali());
          const end = getEndOfWeek(getTodayJalali());
          const startISO = gregorianToISO(toGregorian(start.year, start.month, start.day));
          const endISO = gregorianToISO(toGregorian(end.year, end.month, end.day));
          const weekTasks = tasks.filter((t) => t.dueDate >= startISO && t.dueDate <= endISO);
          const completed = weekTasks.filter((t) => t.status === 'completed').length;
          const pending = weekTasks.filter((t) => t.status === 'pending').length;
          return calendarAi.generateWeeklyInsight(completed, pending);
        }
        case 'show_upcoming': {
          const iso = getTodayISO();
          const upcoming = tasks
            .filter((t) => t.dueDate >= iso && t.status === 'pending')
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .slice(0, 8);
          if (upcoming.length === 0) return 'کار پیش‌رویی نداری.';
          let text = 'کارهای پیش‌رو:\n\n';
          for (const t of upcoming) {
            text += `• ${t.title} — ${formatISOToJalaliLong(t.dueDate)} [${PRIORITY_LABELS[t.priority]}]\n`;
          }
          return text.trim();
        }
        case 'complete_task': {
          const id = (intent.id as string) || '';
          const titleQ = ((intent.title as string) || '').trim();
          const target =
            tasks.find((t) => t.status === 'pending' && (t.id === id || (titleQ && t.title.includes(titleQ)))) ??
            tasks.find((t) => t.status === 'pending' && (t.dueDate === todayISO || t.dueDate < todayISO));
          if (!target) return 'کار در جریانی برای علامت‌زدن پیدا نکردم.';
          toggleTask(target.id);
          return `✓ «${target.title}» به‌عنوان انجام‌شده علامت خورد.`;
        }
        default:
          return null;
      }
    },
    [events, tasks, holidays, preferences, toggleTask, buildDayScheduleText, todayISO],
  );

  // Local/Offline Smart Program Manager Fallback when LLM proxy is unavailable
  const runLocalFallback = useCallback(
    async (text: string): Promise<Omit<ChatMessage, 'id'>> => {
      // Special local smart commands: prioritize / plan day / overdue
      if (/اولویت|پیشنهاد\s*چیدمان/.test(text) && !/خودکار/.test(text)) {
        const pending = tasks
          .filter((t) => t.status === 'pending' && t.dueDate <= todayISO)
          .sort((a, b) => {
            const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
            return rank[a.priority] - rank[b.priority];
          });
        const slots = findFreeSlots({
          events,
          tasks,
          holidays,
          workStart: preferences?.workStart ?? '08:00',
          workEnd: preferences?.workEnd ?? '20:00',
          workDays: preferences?.workDays ?? [6, 0, 1, 2, 3],
          durationMinutes: 45,
          daysAhead: 1,
        }).slots;

        if (pending.length === 0) {
          return {
            role: 'assistant',
            offlineFallback: true,
            content: 'الان کارِ در جریان یا عقب‌افتاده‌ای نداری! هر کار جدیدی بگی برات زمان‌بندی می‌کنم.',
          };
        }

        let plan = 'پیشنهاد چیدمان و اولویت‌بندی امروز:\n\n';
        pending.slice(0, 5).forEach((t, idx) => {
          const slot = slots[idx];
          plan += `${toFaDigits(String(idx + 1))}. [${PRIORITY_LABELS[t.priority]}] ${t.title}${
            t.dueTime
              ? ` — ساعت ${toFaDigits(t.dueTime)}`
              : slot
                ? ` — پیشنهاد: ${toFaDigits(slot.startTime)}`
                : ''
          }\n`;
        });
        return { role: 'assistant', offlineFallback: true, content: plan.trim() };
      }

      if (/عقب|تاخیر|گذشته/.test(text)) {
        const overdue = tasks.filter((t) => t.status === 'pending' && t.dueDate < todayISO);
        if (overdue.length === 0) {
          return { role: 'assistant', offlineFallback: true, content: 'هیچ کار عقب‌افتاده‌ای نداری!' };
        }
        const list = overdue
          .slice(0, 6)
          .map((t) => `• ${t.title} (${formatISOToJalaliLong(t.dueDate)})`)
          .join('\n');
        return {
          role: 'assistant',
          offlineFallback: true,
          content: `کارهای عقب‌افتاده (${toFaDigits(String(overdue.length))} مورد):\n\n${list}`,
        };
      }

      const parsed = calendarAi.parseUserIntent(text);
      const intent = parsed.intent;
      if (intent && ['find_free_time', 'show_today', 'show_day', 'summarize_week', 'show_upcoming'].includes(intent.action)) {
        const info = handleInfoIntent(intent);
        if (info) return { role: 'assistant', offlineFallback: true, content: info };
      }

      if (intent && !parsed.needsConfirmation) {
        await handleConfirm(intent as unknown as Record<string, unknown>);
        return { role: 'assistant', offlineFallback: true, content: '' };
      }

      const fallbackReply =
        parsed.confirmationMessage ||
        'متوجه نشدم. می‌تونی دقیق‌تر بگی؟ مثلاً «فردا ساعت ۱۰ جلسه دارم» یا «برنامه امروز چیه؟».';

      if (parsed.needsConfirmation && intent) {
        return {
          role: 'assistant',
          offlineFallback: true,
          content: fallbackReply,
          intentData: intent as unknown as Record<string, unknown>,
          actions: [
            { label: 'ثبت کن', type: 'confirm' },
            { label: 'انصراف', type: 'cancel' },
          ],
        };
      }

      return {
        role: 'assistant',
        offlineFallback: true,
        content: fallbackReply,
      };
    },
    [tasks, events, holidays, preferences, todayISO, handleInfoIntent, handleConfirm],
  );

  const processUserInput = useCallback(
    async (text: string) => {
      setThinking(true);

      if (!canUseAiAssistant()) {
        setThinking(false);
        openUpgradeModal('no-ai-credits');
        pushMessage({
          role: 'assistant',
          content: 'سهمیه پیام‌های دستیار امروزت تمام شده. برای ادامه، طرحت رو ارتقا بده — از پنجره‌ای که باز شد می‌تونی انتخاب کنی.',
        });
        return;
      }

      const normalized = text.trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
      const isConfirmText =
        /^(لطفاً\s*|لطفا\s*)?(بله|آره|اره|ثبت\s*کن|ثبتش\s*کن|کار\s*(رو|را)?\s*ثبت\s*کن|رویداد\s*(رو|را)?\s*ثبت\s*کن|تایید|تأیید|تایید\s*کن|باشه|اوکی|OK|درسته|انجام\s*بده|بله\s*ثبت\s*کن)\s*[!؟.]*$/i.test(
          normalized,
        );
      const isCancelText =
        /^(نه|لغو|بی‌خیال|بیخیال|کنسل|انصراف|نمی‌خوام|نمیخوام|لغو\s*کن)\s*[!؟.]*$/i.test(normalized);
      if (isConfirmText || isCancelText) {
        const lastActionMsg = [...messages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.actions && m.actions.length > 0 && m.intentData);
        if (lastActionMsg && lastActionMsg.intentData) {
          clearActions();
          setThinking(false);
          if (isConfirmText) await handleConfirm(lastActionMsg.intentData);
          else pushMessage({ role: 'assistant', content: 'باشه، انصراف دادم.' });
          return;
        }
      }

      if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setThinking(false);
        pushMessage({
          role: 'assistant',
          content:
            'دستیار الان خوابه! 😴\n\nبرای گفتگو با دستیار هوشمند، گوشی باید به اینترنت متصل باشه. اما تقویم، کارها، رویدادها و آلارم‌ها در حالت آفلاین هم کامل کار می‌کنن.',
        });
        return;
      }

      const contextMessages = [
        ...messages
          .filter((m) => !m.actions || m.actions.length === 0)
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      const llmResponse = await callLLM(contextMessages, tasks, events, holidays, {
        preferences,
        profile: {
          fullName: user?.full_name,
          jobTitle: preferences?.onboarding?.jobTitle,
          organization: undefined,
        },
        notes,
      });

      if (!llmResponse || isLLMError(llmResponse)) {
        setThinking(false);
        const isNotConfigured = isLLMError(llmResponse) && llmResponse.notConfigured;
        pushMessage({
          role: 'assistant',
          content: isNotConfigured
            ? 'سرویس هوش مصنوعی از پنل مدیریت هنوز تنظیم نشده است.'
            : 'دستیار الان خوابه! 😴\n\nاتصال به سرور هوش مصنوعی برقرار نشد. لطفاً اینترنت خود را بررسی کنید و دوباره تلاش کنید.',
        });
        return;
      }

      void incrementAiAssistant(user?.id ?? 'local');

      const intent = llmResponse.intent as AIIntent | null;

      if (llmResponse.clarify && (llmResponse.clarify.partialIntent || llmResponse.clarify.quickReplies.length > 0)) {
        setThinking(false);
        pushMessage({
          role: 'assistant',
          content: llmResponse.reply,
          clarify: llmResponse.clarify,
          intentData: llmResponse.clarify.partialIntent,
        });
        return;
      }

      const explicitUserCommand =
        /ثبت\s*کن|ثبتش\s*کن|اضافه\s*کن|یادم\s*بنداز|یادآوری\s*کن|برام\s*بذار|بگذار|تنظیم\s*کن/.test(normalized);
      const isDestructive = intent?.action === 'delete_task' || intent?.action === 'delete_event';

      if (intent && ['find_free_time', 'show_today', 'show_day', 'summarize_week', 'show_upcoming'].includes(intent.action)) {
        const info = handleInfoIntent(intent);
        setThinking(false);
        pushMessage({ role: 'assistant', content: info ?? llmResponse.reply });
        return;
      }

      // Auto-execute when LLM says needsConfirmation:false OR user explicitly commanded registration (and not destructive)
      if (intent && (!llmResponse.needsConfirmation || (explicitUserCommand && !isDestructive))) {
        setThinking(false);
        await handleConfirm(intent);
        return;
      }

      if (llmResponse.needsConfirmation && intent) {
        setThinking(false);
        pushMessage({
          role: 'assistant',
          content: llmResponse.reply,
          intentData: intent,
          actions: [
            { label: 'ثبت کن', type: 'confirm' },
            { label: 'انصراف', type: 'cancel' },
          ],
        });
        return;
      }

      setThinking(false);
      pushMessage({ role: 'assistant', content: llmResponse.reply });
    },
    [
      messages,
      tasks,
      events,
      holidays,
      preferences,
      user,
      canUseAiAssistant,
      incrementAiAssistant,
      openUpgradeModal,
      handleConfirm,
      handleInfoIntent,
      runLocalFallback,
      clearActions,
      pushMessage,
    ],
  );

  const sendPrompt = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || thinking) return;
      pushMessage({ role: 'user', content: trimmed });
      void processUserInput(trimmed);
    },
    [thinking, pushMessage, processUserInput],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    sendPrompt(text);
  }, [input, thinking, sendPrompt]);

  const handleActionClick = useCallback(
    async (action: 'confirm' | 'cancel', msg: ChatMessage) => {
      clearActions();
      if (action === 'confirm' && msg.intentData) {
        await handleConfirm(msg.intentData);
      } else {
        pushMessage({ role: 'assistant', content: 'باشه، انصراف دادم.' });
      }
    },
    [clearActions, handleConfirm, pushMessage],
  );

  useEffect(() => {
    const prompt = consumePendingAiPrompt();
    if (prompt) {
      pushMessage({ role: 'user', content: prompt });
      void processUserInput(prompt);
    }
  }, [consumePendingAiPrompt, pushMessage, processUserInput]);

  const silenceTimerRef = useRef<number | null>(null);

  const toggleListening = useCallback(async () => {
    setVoiceError(null);
    if (isListening) {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // Request native Android microphone permission if running inside Capacitor APK
    try {
      const cap = (window as unknown as {
        Capacitor?: { Plugins?: { Downloads?: { requestMicrophonePermission?: () => Promise<{ granted?: boolean }> } } };
      }).Capacitor;
      const reqMic = cap?.Plugins?.Downloads?.requestMicrophonePermission;
      if (typeof reqMic === 'function') {
        const perm = await reqMic();
        if (!perm?.granted) {
          setVoiceError('دسترسی میکروفون داده نشد. لطفاً از تنظیمات گوشی مجوز میکروفون را فعال کنید.');
          return;
        }
      }
    } catch {
      /* continue to web speech check */
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceError('مرورگر شما از تبدیل گفتار به متن پشتیبانی نمی‌کند.');
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const recognition = new Ctor();
    recognition.lang = 'fa-IR';
    recognition.interimResults = true;
    recognition.continuous = true;

    let finalTranscript = '';
    let latestCombined = '';

    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = window.setTimeout(() => {
        silenceTimerRef.current = null;
        recognition.stop();
      }, 2800);
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? '';
        if (res.isFinal) {
          finalTranscript += text + ' ';
        } else {
          interim += text;
        }
      }
      latestCombined = (finalTranscript + interim).trim();
      setInput(latestCombined);
      if (latestCombined) {
        resetSilenceTimer();
      }
    };

    recognition.onerror = (event) => {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setIsListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceError('دسترسی میکروفون داده نشد. لطفاً مجوز میکروفون را فعال کنید.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setVoiceError('خطا در دریافت صدا. دوباره تلاش کنید.');
      }
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setIsListening(false);
      const textToSend = (finalTranscript || latestCombined).trim();
      if (textToSend && !thinking) {
        setInput('');
        pushMessage({ role: 'user', content: textToSend });
        void processUserInput(textToSend);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setVoiceError('امکان شروع ضبط صدا وجود ندارد.');
    }
  }, [isListening, thinking, pushMessage, processUserInput]);

  const handleResetChat = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    const initial: ChatMessage[] = [{ id: nextId(), role: 'assistant', content: buildGreeting() }];
    lastSpokenIdRef.current = initial[0].id;
    setMessages(initial);
    saveMessages(initial);
  };

  const quickPrompts = [
    'برنامه امروزم چیه؟',
    'کارهای امروز رو برام اولویت‌بندی کن',
    'فردا ساعت ۱۰ جلسه با تیم دارم',
    'هفته پیش رو چه زمانی آزادم؟',
    'خلاصه عملکرد این هفته‌ام چطوره؟',
    'چه تاریخی برای مسافرت خوبه؟',
  ];

  const renderIntentPreview = (intentData: Record<string, unknown>) => {
    const action = (intentData.action as string) || '';
    const title = (intentData.title as string) || '';
    const dateRaw = (intentData.date as string) || '';
    const iso = dateRaw ? intentDateToISO(dateRaw) : null;
    const dateLabel = iso ? formatISOToJalaliLong(iso) : dateRaw;
    const time = (intentData.startTime as string) || (intentData.time as string) || '';
    const endTime = (intentData.endTime as string) || '';
    const location = (intentData.location as string) || '';
    const priority = intentData.priority as Priority | undefined;
    const category = intentData.category as TaskCategory | undefined;
    const recurrence = intentData.recurrence as string | undefined;
    const isCreate = action.startsWith('create_');
    const conflict = isCreate && iso && time ? detectConflict(iso, time) : null;

    return (
      <div className="mt-2 rounded-2xl border border-slate-200/80 bg-surface/90 p-3 space-y-2 text-right">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-700">
            <Sparkles className="h-3 w-3" />
            {ACTION_LABELS[action] ?? 'عملیات'}
          </span>
          {priority && PRIORITY_LABELS[priority] && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              اولویت: {PRIORITY_LABELS[priority]}
            </span>
          )}
        </div>

        {title && <p className="text-xs font-bold text-slate-900">{title}</p>}

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          {dateLabel && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 border border-slate-200/70">
              <CalendarDays className="h-3 w-3 text-primary-500" />
              {dateLabel}
            </span>
          )}
          {time && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 border border-slate-200/70">
              <Clock className="h-3 w-3 text-accent-600" />
              {toFaDigits(time)}
              {endTime ? ` تا ${toFaDigits(endTime)}` : ''}
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 border border-slate-200/70">
              <MapPin className="h-3 w-3 text-slate-400" />
              {location}
            </span>
          )}
          {category && CATEGORY_LABELS[category] && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 border border-slate-200/70">
              <Tag className="h-3 w-3 text-slate-400" />
              {CATEGORY_LABELS[category]}
            </span>
          )}
          {recurrence && recurrence !== 'none' && RECURRENCE_LABELS[recurrence] && (
            <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-accent-700">
              <Repeat className="h-3 w-3" />
              {RECURRENCE_LABELS[recurrence]}
            </span>
          )}
        </div>

        {conflict && (
          <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>هشدار: {conflict}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-12.5rem)] flex-col lg:h-[calc(100vh-5rem)]">
      {/* Assistant header with identity */}
      <div className="card-premium mb-2.5 flex items-center justify-between rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-700 to-primary-950 text-white shadow-lg shadow-primary-900/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="absolute -bottom-0.5 -left-0.5 h-3.5 w-3.5 rounded-full bg-accent-400 border-2 border-white" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">مدیر برنامه هوشمند یادتو</h2>
            <p className="text-[11px] text-accent-600 font-medium flex items-center gap-1">
              <Brain className="h-3 w-3" />
              متصل به تقویم، کارها و موتور زمان‌بندی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !voiceReplyEnabled;
              setVoiceReplyEnabled(next);
              if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              voiceReplyEnabled
                ? 'border-accent-300 bg-accent-50 text-accent-700'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
            title={voiceReplyEnabled ? 'خاموش کردن پاسخ صوتی' : 'روشن کردن پاسخ صوتی'}
          >
            {voiceReplyEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{voiceReplyEnabled ? 'پاسخ صوتی فعال' : 'پاسخ صوتی'}</span>
          </button>

          {messages.length > 1 && (
            <button
              onClick={handleResetChat}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              title="شروع گفتگوی جدید"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">گفتگوی جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Offline sleep banner */}
      {!isOnline && (
        <div className="mb-2.5 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Moon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="font-bold flex items-center gap-1.5">
              دستیار الان خوابه! 😴
              <WifiOff className="h-3.5 w-3.5 text-amber-600" />
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              برای بیدار شدن و گفتگو با دستیار به اینترنت نیاز دارید (تقویم، کارها و آلارم آفلاین فعال‌اند).
            </p>
          </div>
        </div>
      )}

      {/* Live Program Manager Context Strip */}
      <div className="mb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
        <button
          onClick={() => sendPrompt('برنامه امروزم چیه؟')}
          className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700 transition-colors"
        >
          <ListTodo className="h-3.5 w-3.5 text-primary-600" />
          {toFaDigits(String(todayPendingCount))} کار امروز
        </button>
        <button
          onClick={() => sendPrompt('رویدادهای امروز چیا هستن؟')}
          className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-accent-300 hover:text-accent-700 transition-colors"
        >
          <CalendarDays className="h-3.5 w-3.5 text-accent-600" />
          {toFaDigits(String(todayEventsCount))} رویداد
        </button>
        <button
          onClick={() => sendPrompt('زمان‌های آزاد این هفته کجاست؟')}
          className="shrink-0 flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-cyan-300 hover:text-cyan-700 transition-colors"
        >
          <Coffee className="h-3.5 w-3.5 text-cyan-600" />
          زمان آزاد: {formatFreeTime(todaySchedule.freeMinutes)}
        </button>
        {overdueCount > 0 && (
          <button
            onClick={() => sendPrompt('کارهای عقب‌افتاده‌ام چیا هستن؟')}
            className="shrink-0 flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition-colors"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            {toFaDigits(String(overdueCount))} عقب‌افتاده
          </button>
        )}
        <button
          onClick={() => sendPrompt('کارهای بدون ساعت من رو به‌صورت خودکار در وقت‌های آزاد بچین')}
          className="shrink-0 flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-1.5 text-[11px] font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary-600" />
          چیدمان خودکار کارها
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            {m.role === 'assistant' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-700 to-primary-950 text-white ml-2 mt-1 self-end">
                <Sparkles className="h-4 w-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] sm:max-w-[78%] space-y-2 rounded-2xl px-4 py-3 text-sm leading-6 ${
                m.role === 'user'
                  ? 'rounded-bl-md bg-primary-700 text-white shadow-sm'
                  : 'card-base rounded-br-md text-slate-700'
              }`}
            >
              {m.offlineFallback && (
                <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  پردازش آفلاین هوشمند
                </span>
              )}

              <p className="whitespace-pre-line text-right">{m.content}</p>

              {/* Structured Action Preview Card */}
              {m.intentData && m.actions && m.actions.length > 0 && renderIntentPreview(m.intentData)}

              {/* Clarify Quick Replies & Smart Pickers */}
              {m.clarify && (
                <div className="space-y-2 pt-1">
                  {m.clarify.quickReplies.length > 0 && (
                    <div className="flex flex-wrap justify-start gap-1.5">
                      {m.clarify.quickReplies.map((qr) => (
                        <button
                          key={qr}
                          onClick={() => sendPrompt(qr)}
                          className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
                        >
                          {qr}
                        </button>
                      ))}
                    </div>
                  )}

                  {m.clarify.needsDatePicker && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">تاریخ سریع:</span>
                      {['امروز', 'فردا', 'پس‌فردا', 'شنبه آینده'].map((d) => (
                        <button
                          key={d}
                          onClick={() => sendPrompt(d)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}

                  {m.clarify.needsTimePicker && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">ساعت سریع:</span>
                      {['۰۹:۰۰', '۱۱:۰۰', '۱۴:۰۰', '۱۷:۰۰', '۲۰:۰۰'].map((t) => (
                        <button
                          key={t}
                          onClick={() => sendPrompt(`ساعت ${t}`)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-accent-300 hover:text-accent-700"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}

                  {m.clarify.needsPriorityPicker && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">اولویت:</span>
                      {['اولویت بالا', 'اولویت متوسط', 'اولویت کم'].map((p) => (
                        <button
                          key={p}
                          onClick={() => sendPrompt(p)}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {m.actions && m.actions.length > 0 && (
                <div className="flex justify-start gap-2 pt-1">
                  <button
                    onClick={() => void handleActionClick('confirm', m)}
                    className="flex items-center gap-1.5 rounded-xl bg-accent-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-700 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {m.actions.find((a) => a.type === 'confirm')?.label ?? 'تایید و ثبت'}
                  </button>
                  <button
                    onClick={() => void handleActionClick('cancel', m)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    {m.actions.find((a) => a.type === 'cancel')?.label ?? 'لغو'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-end">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-700 to-primary-950 text-white ml-2 self-end">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="card-base flex items-center gap-2 rounded-2xl rounded-br-md px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:0.3s]" />
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts (only at start) */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap justify-start gap-2 pb-2">
          {quickPrompts.map((q) => (
            <button
              key={q}
              onClick={() => sendPrompt(q)}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-primary-300 hover:text-primary-700 transition-colors"
            >
              <Zap className="h-3 w-3 text-accent-500" />
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Voice status / error */}
      {(isListening || voiceError) && (
        <div
          className={`mb-2 flex items-center justify-between rounded-xl px-3.5 py-2 text-xs ${
            voiceError
              ? 'bg-red-50 text-red-600 border border-red-100'
              : 'bg-accent-50 text-accent-800 border border-accent-200'
          }`}
        >
          <span className="flex items-center gap-2 font-medium">
            {isListening && <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />}
            {voiceError ?? 'در حال گوش دادن... با مکث ۳ ثانیه‌ای یا زدن دکمه میکروفون ارسال می‌شود'}
          </span>
          {voiceError && (
            <button onClick={() => setVoiceError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="card-base flex items-center gap-2 rounded-2xl p-2">
        <button
          type="button"
          onClick={toggleListening}
          disabled={thinking}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
              : 'bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-700'
          } disabled:opacity-40`}
          aria-label={isListening ? 'توقف ضبط صدا' : 'گفتگوی صوتی'}
          title={isListening ? 'توقف ضبط صدا' : 'صحبت با دستیار'}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={isListening ? 'در حال شنیدن صدای شما...' : 'بنویس یا صحبت کن... مثلاً «پنجشنبه ساعت ۱۵ آزمایش دارم»'}
          className="flex-1 bg-transparent px-2 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white transition-colors hover:bg-primary-800 disabled:opacity-40"
          aria-label="ارسال"
        >
          <Send className="h-4 w-4 -scale-x-100" />
        </button>
      </div>

      <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
        <MapPin className="h-3 w-3" />
        همگام‌سازی امن با حساب کاربری شما
        <CalendarClock className="h-3 w-3" />
      </p>
    </div>
  );
}
