import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Check, X, CalendarClock, MapPin, Mic, Brain, Zap } from 'lucide-react';
import { useCalendarStore } from '@/store/calendarStore';
import { usePlanStore } from '@/store/planStore';
import { useAuthStore } from '@/store/authStore';
import { getItem as getStoredItem, setItem as setStoredItem } from '@/lib/safeStorage';
import { callLLM, isLLMError, type ClarifyData } from '@/services/calendar/calendarLlm';
import { calendarAi } from '@/services/calendar/calendarAi';
import { findFreeSlots, getVisibleTasksForDate } from '@/services/calendar/schedulingEngine';
import { scheduleTaskReminder } from '@/services/calendar/notifications';
import type { AIIntent, UserPreferences } from '@/types/calendar';
import {
  getTodayJalali,
  formatJalali,
  getTodayISO,
  toFaDigits,
  parseJalali,
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
}

let messageCounter = Date.now();
const nextId = () => `msg-${messageCounter++}`;

const CHAT_KEY = 'assistant_chat_v1';

interface StoredChat { messages: ChatMessage[] }

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

function buildGreeting(): string {
  return `سلام! من «یادتو» هستم — مدیر برنامه شخصی تو

این کارها رو برات انجام می‌دم:
• ثبت کار و رویداد فقط با یک جمله («فردا ساعت ۱۰ جلسه دارم» یا «یادم بنداز پنجشنبه قبض رو بپردازم»)
• برنامه امروز یا هر روز دلخواه، دقیق و مرتب بر اساس ساعت
• کارهای تکرارشونده (قسط ماهانه، کلاس هفتگی، ورزش روزانه)
• پیدا کردن زمان آزاد و پیشنهاد بهترین وقت برای کارهای جدید
• جستجوی وب برای اطلاعات زنده (مثل بازی بعدی پرسپولیس!) و ثبتش به‌عنوان رویداد
• هشدار تداخل زمانی و پیشنهاد جابه‌جایی
• پیشنهاد بهترین تاریخ برای مسافرت بر اساس تعطیلات و برنامه‌ات

از یکی از پیشنهادهای زیر شروع کن یا هرچی تو ذهنت هست بگو.`;
}

export function AssistantPage() {
  const tasks = useCalendarStore((s) => s.tasks);
  const events = useCalendarStore((s) => s.events);
  const holidays = useCalendarStore((s) => s.holidays);
  const preferences = useCalendarStore((s) => s.preferences);
  const addTask = useCalendarStore((s) => s.addTask);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const toggleTask = useCalendarStore((s) => s.toggleTask);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const updateTask = useCalendarStore((s) => s.updateTask);
  const user = useAuthStore((s) => s.user);
  const canUseAiAssistant = usePlanStore((s) => s.canUseAiAssistant);
  const incrementAiAssistant = usePlanStore((s) => s.incrementAiAssistant);
  const canUseTemplate = usePlanStore((s) => s.canUseTemplate);
  const incrementTemplate = usePlanStore((s) => s.incrementTemplate);
  const openUpgradeModal = usePlanStore((s) => s.openUpgradeModal);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = loadStoredMessages();
    if (stored.length > 0) return stored;
    return [{ id: '0', role: 'assistant', content: buildGreeting() }];
  });
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const pushMessage = useCallback((m: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => {
      const next = [...prev, { ...m, id: nextId() }];
      saveMessages(next);
      return next;
    });
  }, []);

  const clearActions = useCallback(() => {
    setMessages((prev) => prev.map((m) => (m.actions?.length ? { ...m, actions: [] } : m)));
  }, []);

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
        const task = addTask({
          title,
          dueDate: iso,
          dueTime: (intentData.time as string) || undefined,
          priority: 'medium',
          category: 'personal',
          status: 'pending',
          recurrence: (intentData.recurrence as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'none',
        });
        if (task && task.dueTime) {
          await scheduleTaskReminder(task.title, task.dueDate, task.dueTime, preferences?.defaultReminder ?? 15);
        }
        void incrementTemplate(user?.id ?? 'local');
        pushMessage({
          role: 'assistant',
          content: `✓ کار «${title}» برای ${formatJalali(parseJalali(dateStr) ?? getTodayJalali(), 'long')}${
            intentData.time ? ` ساعت ${toFaDigits(intentData.time as string)}` : ''
          } ثبت شد.${task.dueTime ? ` ${toFaDigits(preferences?.defaultReminder ?? 15)} دقیقه قبل یادآوری می‌کنم.` : ''}`,
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
        const time = (intentData.time as string) || '10:00';
        const event = addEvent({ title, date: iso, startTime: time, color: '#4338ca', category: 'work' });
        if (event) {
          await scheduleTaskReminder(event.title, event.date, event.startTime, preferences?.defaultReminder ?? 15);
        }
        void incrementTemplate(user?.id ?? 'local');
        pushMessage({
          role: 'assistant',
          content: `✓ رویداد «${title}» برای ${formatJalali(parseJalali(dateStr) ?? getTodayJalali(), 'long')} ساعت ${toFaDigits(time)} ثبت شد.`,
        });
        return;
      }

      if (action === 'delete_task') {
        const id = (intentData.id as string) || '';
        const target = tasks.find((t) => t.id === id || t.title === (intentData.title as string));
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
        const target = events.find((e) => e.id === id || e.title === (intentData.title as string));
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
        const target = tasks.find((t) => t.id === id || t.title === (intentData.title as string));
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
        updateTask(target.id, {
          dueDate: iso,
          dueTime: (intentData.time as string) || target.dueTime,
        });
        const d = parseJalali(iso.replace(/-/g, '/'));
        pushMessage({
          role: 'assistant',
          content: `✓ «${target.title}» به ${d ? formatJalali(d, 'long') : iso}${intentData.time ? ` ساعت ${toFaDigits(intentData.time as string)}` : ''} منتقل شد.`,
        });
        return;
      }

      pushMessage({ role: 'assistant', content: 'این عملیات هنوز پشتیبانی نمی‌شود.' });
    },
    [addTask, addEvent, toggleTask, deleteTask, deleteEvent, updateTask, tasks, events, preferences, pushMessage, canUseTemplate, incrementTemplate, openUpgradeModal, user],
  );

  const handleInfoIntent = useCallback(
    (intent: AIIntent): string | null => {
      switch (intent.action) {
        case 'find_free_time': {
          const duration = (intent.duration as number) || 120;
          const result = findFreeSlots({
            events,
            tasks,
            holidays,
            workStart: preferences?.workStart ?? '08:00',
            workEnd: preferences?.workEnd ?? '20:00',
            workDays: preferences?.workDays ?? [0, 1, 2, 3, 4],
            durationMinutes: duration,
          });
          return calendarAi.generateScheduleSuggestion(result.slots, 'کار پیشنهادی');
        }
        case 'show_today': {
          const todayISO = getTodayISO();
          const dayTasks = tasks.filter((t) => t.dueDate === todayISO && t.status === 'pending');
          const dayEvents = events.filter((e) => e.date === todayISO);
          let text = `برنامه امروز (${formatJalali(getTodayJalali(), 'long')}):\n\n`;
          if (dayEvents.length === 0 && dayTasks.length === 0) {
            text += 'امروز برنامه‌ای نداری. روزت خالیه!';
          } else {
            for (const e of dayEvents) text += `• رویداد: ${e.title} — ساعت ${toFaDigits(e.startTime)}\n`;
            for (const t of dayTasks)
              text += `• کار: ${t.title}${t.dueTime ? ` — ساعت ${toFaDigits(t.dueTime)}` : ''}\n`;
          }
          return text.trim();
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
          const today = getTodayJalali();
          let text = 'کارهای پیش‌رو:\n\n';
          const upcoming = tasks
            .filter((t) => {
              const iso = gregorianToISO(toGregorian(today.year, today.month, today.day));
              return t.dueDate >= iso && t.status === 'pending';
            })
            .slice(0, 8);
          if (upcoming.length === 0) return 'کار پیش‌رویی نداری.';
          for (const t of upcoming) {
            const d = parseJalali(t.dueDate.replace(/-/g, '/'));
            text += `• ${t.title} — ${d ? formatJalali(d, 'long') : t.dueDate}\n`;
          }
          return text.trim();
        }
        case 'complete_task': {
          const todayISO = getTodayISO();
          const target = tasks.find(
            (t) => t.status === 'pending' && (t.dueDate === todayISO || t.dueDate < todayISO),
          );
          if (!target) return 'کار در جریانی برای علامت‌زدن پیدا نکردم.';
          toggleTask(target.id);
          return `✓ «${target.title}» به‌عنوان انجام‌شده علامت خورد.`;
        }
        default:
          return null;
      }
    },
    [events, tasks, holidays, preferences, toggleTask],
  );

  const offlineMessage: Omit<ChatMessage, 'id'> = {
    role: 'assistant',
    content:
      'دستیار در حال حاضر آفلاین است و نمی‌توانم پاسخ بدهم.\n\n' +
      'برای فعال‌سازی دستیار، مدیر سیستم باید از «پنل مدیریت ← هوش مصنوعی» سرویس را تنظیم کند.\n' +
      'ثبت دستی کارها و رویدادها از تب‌های «کارها» و «تقویم» همچنان در دسترس است.',
  };

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

      const isConfirmText = /^(بله|آره|ثبت کن|تأیید|باشه|درسته|انجام بده)\s*[!؟.]?$/i.test(text.trim());
      const isCancelText = /^(نه|لغو|بی‌خیال|کنسل|انصراف|نمی‌خوام)\s*[!؟.]?$/i.test(text.trim());
      if (isConfirmText || isCancelText) {
        const lastActionMsg = [...messages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.actions && m.actions.length > 0 && m.intentData);
        if (lastActionMsg && lastActionMsg.intentData) {
          clearActions();
          setThinking(false);
          if (isConfirmText) await handleConfirm(lastActionMsg.intentData);
          return;
        }
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
      });

      if (!llmResponse) {
        setThinking(false);
        pushMessage(offlineMessage);
        return;
      }

      if (isLLMError(llmResponse)) {
        setThinking(false);
        pushMessage(offlineMessage);
        return;
      }

      void incrementAiAssistant(user?.id ?? 'local');

      const intent = llmResponse.intent as AIIntent | null;

      if (llmResponse.clarify && llmResponse.clarify.partialIntent) {
        setThinking(false);
        pushMessage({
          role: 'assistant',
          content: llmResponse.reply,
          clarify: llmResponse.clarify,
          intentData: llmResponse.clarify.partialIntent,
        });
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

      if (intent && ['find_free_time', 'show_today', 'show_day', 'summarize_week', 'show_upcoming', 'complete_task'].includes(intent.action)) {
        const info = handleInfoIntent(intent);
        setThinking(false);
        pushMessage({ role: 'assistant', content: info ?? llmResponse.reply });
        return;
      }

      setThinking(false);
      pushMessage({ role: 'assistant', content: llmResponse.reply });
    },
    [messages, tasks, events, holidays, handleConfirm, handleInfoIntent, clearActions, pushMessage],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || thinking) return;
    pushMessage({ role: 'user', content: text });
    setInput('');
    void processUserInput(text);
  }, [input, thinking, pushMessage, processUserInput]);

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

  const quickPrompts = [
    'برنامه امروزم چیه؟',
    'فردا ساعت ۱۰ جلسه دارم',
    'یادم بنداز پنجشنبه قبض رو بپردازم',
    'هفته پیش رو چه زمانی آزادم؟',
    'چه تاریخی برای مسافرت خوبه؟',
  ];

  return (
    <div className="flex h-[calc(100vh-14rem)] flex-col lg:h-[calc(100vh-12rem)]">
      {/* Assistant header with identity */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-700 to-primary-950 text-white shadow-lg shadow-primary-900/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="absolute -bottom-0.5 -left-0.5 h-3.5 w-3.5 rounded-full bg-accent-400 border-2 border-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">یادتو</h2>
          <p className="text-[11px] text-accent-600 font-medium flex items-center gap-1">
            <Brain className="h-3 w-3" />
            دستیار هوشمند شخصی
          </p>
        </div>
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
              className={`max-w-[80%] space-y-2 rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                m.role === 'user'
                  ? 'rounded-bl-md bg-primary-700 text-white'
                  : 'card-base rounded-br-md text-slate-700'
              }`}
            >
              <p className="whitespace-pre-line text-right">{m.content}</p>

              {m.clarify && m.clarify.quickReplies.length > 0 && (
                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  {m.clarify.quickReplies.map((qr) => (
                    <button
                      key={qr}
                      onClick={() => {
                        pushMessage({ role: 'user', content: qr });
                        void processUserInput(qr);
                      }}
                      className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs text-primary-700 hover:bg-primary-100 transition-colors"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              {m.actions && m.actions.length > 0 && (
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => void handleActionClick('confirm', m)}
                    className="flex items-center gap-1 rounded-full bg-accent-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {m.actions.find((a) => a.type === 'confirm')?.label ?? 'تایید'}
                  </button>
                  <button
                    onClick={() => void handleActionClick('cancel', m)}
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
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
        <div className="flex flex-wrap justify-end gap-2 pb-2">
          {quickPrompts.map((q) => (
            <button
              key={q}
              onClick={() => {
                pushMessage({ role: 'user', content: q });
                void processUserInput(q);
              }}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-primary-300 hover:text-primary-700 transition-colors"
            >
              <Zap className="h-3 w-3 text-accent-500" />
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="card-base flex items-center gap-2 rounded-2xl p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="بنویس... مثلاً «پنجشنبه ساعت ۱۵ آزمایش دارم»"
          className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-700 text-white transition-colors hover:bg-primary-800 disabled:opacity-40"
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
