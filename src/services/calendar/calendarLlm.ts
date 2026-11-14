/**
 * LLM bridge for the Smart Calendar assistant — calls the PHP backend's
 * `ai_proxy` action (configured from the admin panel) with rich Jalali
 * context. Returns null on any failure so callers show the offline message.
 */
import { apiCall } from '@/lib/api';
import type { Task, CalendarEvent, Holiday, MJalaliDate } from '@/types/calendar';
import {
  getTodayJalali,
  formatJalali,
  getJalaliWeekdayName,
  toGregorian,
  addJalaliDays,
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  gregorianToISO,
} from '@/utils/jalaliDate';

function dateToISO(date: MJalaliDate): string {
  return gregorianToISO(toGregorian(date.year, date.month, date.day));
}

export interface ClarifyData {
  quickReplies: string[];
  needsDatePicker: boolean;
  needsTimePicker: boolean;
  needsReminderPicker: boolean;
  needsPriorityPicker: boolean;
  partialIntent: Record<string, unknown> | null;
}

export interface LLMResponse {
  reply: string;
  intent: Record<string, unknown> | null;
  needsConfirmation: boolean;
  clarify: ClarifyData | null;
}

export interface LLMError {
  error: string;
  notConfigured: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function isLLMError(resp: LLMResponse | LLMError | null): resp is LLMError {
  return resp !== null && 'error' in resp && !('reply' in resp);
}

const SYSTEM_PROMPT = `تو دستیار هوشمند «تقویم هوشمند» هستی؛ برنامه‌ریز شخصی فارسی‌زبان کاربر.
وظیفه‌ات: ایجاد، تغییر، حذف و خلاصه‌سازی کارها (task) و رویدادها (event) بر اساس تقویم جلالی.

پاسخ را «فقط» به صورت JSON معتبر با این ساختار برگردان:
{
  "reply": "متن پاسخ فارسی و کوتاه به کاربر",
  "intent": null یا یک شیء دستور,
  "needsConfirmation": true/false,
  "clarify": null یا { "quickReplies": ["گزینه ۱","گزینه ۲"], "needsDatePicker": false, "needsTimePicker": false, "needsReminderPicker": false, "needsPriorityPicker": false, "partialIntent": null یا شیء }
}

انواع دستور (فیلد action در intent):
- create_task: { action:"create_task", title, date:"YYYY-MM-DD" میلادی ISO, time:"HH:mm" اختیاری, priority:"low"|"medium"|"high", category, reminder (دقیقه), recurrence:"none"|"daily"|"weekly"|"monthly"|"yearly" }
- create_event: { action:"create_event", title, date:"YYYY-MM-DD" میلادی, startTime:"HH:mm", endTime اختیاری, location اختیاری, category, reminder }
- complete_task: { action:"complete_task", id }
- delete_task: { action:"delete_task", id }
- reschedule_task: { action:"reschedule_task", id, date:"YYYY-MM-DD", time:"HH:mm" اختیاری }
- find_free_time: { action:"find_free_time", date:"YYYY-MM-DD", durationMinutes }
- show_today / show_upcoming / summarize_week: { action:"..." }

قواعد مهم:
- تاریخ‌ها را از متن فارسی (امروز، فردا، شنبه، ۲۵ اسفند…) با استفاده از context جلالی به ISO میلادی تبدیل کن.
- اگر اطلاعات کافی نیست (مثلاً عنوان یا تاریخ نامشخص)، intent را null بده و در clarify گزینه‌های سریع پیشنهاد بده.
- اگر دستور مهمی مثل ایجاد یا حذف است و کاربر صریح نگفته، needsConfirmation را true بگذار.
- reply باید فارسی، دوستانه و خلاصه باشد.`;

export async function callLLM(
  messages: ChatMessage[],
  tasks: Task[],
  events: CalendarEvent[],
  holidays: Holiday[],
): Promise<LLMResponse | LLMError | null> {
  const today = getTodayJalali();
  const tomorrow = addJalaliDays(today, 1);
  const dayAfter = addJalaliDays(today, 2);
  const todayISO = dateToISO(today);
  const tomorrowISO = dateToISO(tomorrow);
  const dayAfterISO = dateToISO(dayAfter);

  const weekStart = getStartOfWeek(today);
  const weekEnd = getEndOfWeek(today);
  const nextWeekStart = addJalaliDays(weekStart, 7);
  const nextWeekEnd = addJalaliDays(weekEnd, 7);
  const monthStart = getStartOfMonth(today);
  const monthEnd = getEndOfMonth(today);

  const weekStartISO = dateToISO(weekStart);
  const weekEndISO = dateToISO(weekEnd);
  const nextWeekStartISO = dateToISO(nextWeekStart);
  const nextWeekEndISO = dateToISO(nextWeekEnd);
  const monthStartISO = dateToISO(monthStart);
  const monthEndISO = dateToISO(monthEnd);

  const mapTask = (t: Task) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    dueTime: t.dueTime,
    priority: t.priority,
  });
  const mapEvent = (e: CalendarEvent) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    startTime: e.startTime,
    location: e.location,
  });

  const range = (from: string, to: string) => ({
    tasks: tasks.filter((t) => t.dueDate >= from && t.dueDate <= to).map(mapTask),
    events: events.filter((e) => e.date >= from && e.date <= to).map(mapEvent),
  });

  const thisWeek = range(weekStartISO, weekEndISO);
  const nextWeek = range(nextWeekStartISO, nextWeekEndISO);
  const thisMonth = range(monthStartISO, monthEndISO);

  const weekDatesList = Array.from({ length: 7 }, (_, i) => {
    const d = addJalaliDays(weekStart, i);
    const iso = dateToISO(d);
    return {
      jalali: formatJalali(d, 'long'),
      weekday: getJalaliWeekdayName(d),
      iso,
      taskCount: tasks.filter((t) => t.dueDate === iso && t.status === 'pending').length,
      eventCount: events.filter((e) => e.date === iso).length,
    };
  });

  const context = {
    todayJalali: formatJalali(today, 'full'),
    todayWeekday: getJalaliWeekdayName(today),
    todayISO,
    tomorrowJalali: formatJalali(tomorrow, 'long'),
    tomorrowISO,
    dayAfterJalali: formatJalali(dayAfter, 'long'),
    dayAfterISO,
    weekStart: formatJalali(weekStart, 'long'),
    weekEnd: formatJalali(weekEnd, 'long'),
    nextWeekStart: formatJalali(nextWeekStart, 'long'),
    nextWeekEnd: formatJalali(nextWeekEnd, 'long'),
    monthStart: formatJalali(monthStart, 'long'),
    monthEnd: formatJalali(monthEnd, 'long'),
    weekDates: weekDatesList,
    todayHolidays: holidays
      .filter((h) => h.gregorianDate === todayISO)
      .map((h) => ({ title: h.title, isOfficialHoliday: h.isOfficialHoliday, description: h.description })),
    tomorrowHolidays: holidays
      .filter((h) => h.gregorianDate === tomorrowISO)
      .map((h) => ({ title: h.title, isOfficialHoliday: h.isOfficialHoliday })),
    todayTasks: tasks.filter((t) => t.dueDate === todayISO && t.status === 'pending').map(mapTask),
    todayEvents: events.filter((e) => e.date === todayISO).map(mapEvent),
    tomorrowTasks: tasks.filter((t) => t.dueDate === tomorrowISO && t.status === 'pending').map(mapTask),
    tomorrowEvents: events.filter((e) => e.date === tomorrowISO).map(mapEvent),
    dayAfterTasks: tasks.filter((t) => t.dueDate === dayAfterISO && t.status === 'pending').map(mapTask),
    dayAfterEvents: events.filter((e) => e.date === dayAfterISO).map(mapEvent),
    thisWeekTasks: thisWeek.tasks,
    thisWeekEvents: thisWeek.events,
    nextWeekTasks: nextWeek.tasks,
    nextWeekEvents: nextWeek.events,
    thisMonthTasks: thisMonth.tasks,
    thisMonthEvents: thisMonth.events,
    pendingTasks: tasks
      .filter((t) => t.status === 'pending')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 30)
      .map(mapTask),
    upcomingEvents: events
      .filter((e) => e.date >= todayISO)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 30)
      .map(mapEvent),
    overdueTasks: tasks
      .filter((t) => t.status === 'pending' && t.dueDate < todayISO)
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, dueTime: t.dueTime })),
  };

  try {
    const data = await apiCall('ai_proxy', {
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n--- CONTEXT (JSON) ---\n${JSON.stringify(context)}` },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.3,
      response_format_json: true,
    });

    const content = (data.content ?? data.data?.content ?? '') as string;
    if (!content) return null;

    // Parse the JSON payload from the model response (tolerate code fences).
    const cleaned = content.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return { reply: cleaned, intent: null, needsConfirmation: false, clarify: null };
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return { reply: cleaned, intent: null, needsConfirmation: false, clarify: null };
    }

    const reply = typeof parsed.reply === 'string' ? parsed.reply : cleaned;
    if (!reply) return null;

    const clarifyRaw = parsed.clarify as Record<string, unknown> | null | undefined;
    const clarify: ClarifyData | null = clarifyRaw
      ? {
          quickReplies: Array.isArray(clarifyRaw.quickReplies) ? (clarifyRaw.quickReplies as string[]) : [],
          needsDatePicker: Boolean(clarifyRaw.needsDatePicker),
          needsTimePicker: Boolean(clarifyRaw.needsTimePicker),
          needsReminderPicker: Boolean(clarifyRaw.needsReminderPicker),
          needsPriorityPicker: Boolean(clarifyRaw.needsPriorityPicker),
          partialIntent: (clarifyRaw.partialIntent as Record<string, unknown>) ?? null,
        }
      : null;

    return {
      reply,
      intent: (parsed.intent as Record<string, unknown>) ?? null,
      needsConfirmation: Boolean(parsed.needsConfirmation),
      clarify,
    };
  } catch (err) {
    console.warn('[SmartCalendar] LLM call failed:', err);
    return null;
  }
}
