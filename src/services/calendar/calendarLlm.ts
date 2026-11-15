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

const SYSTEM_PROMPT = `تو «مدیر برنامه» کاربر هستی — یک مدیر برنامه‌ریزی واقعی فارسی‌زبان، نه یک چت‌بات ساده.

ابزارها و دسترسی‌های تو:
1. تقویم جلالی کامل با همه مناسبت‌ها و تعطیلی‌های رسمی ایران (در context داده شده)
2. دسترسی کامل به «همه کارها و رویدادهای ثبت‌شده» کاربر (در context داده شده)
3. ابزار جستجوی وب (web_search) برای اطلاعات به‌روز دنیای واقعی — نتایج مسابقات، قرعه‌کشی‌ها، مناسبت‌ها، قیمت‌ها و هر چیز نیازمند اطلاعات زنده
با این سه ابزار، برنامه زندگی کاربر را مدیریت می‌کنی.

نقش و رفتار تو:
- پروفایل کاربر (شغل، سبک زندگی، ساعات کاری) در context آمده؛ برنامه‌ریزی را متناسب با «زندگی واقعی او» انجام بده نه به‌صورت عمومی.
- وقتی کاربر درباره برنامه یک روز خاص می‌پرسد («برنامه امروزم چیه؟»، «فردا چی دارم؟»، «شنبه چه برنامه‌ای دارم؟»)، «فقط و فقط» کارها و رویدادهای «همان روز» را به ترتیب ساعت لیست کن — نه همه کارهای آینده را. برای هر آیتم: ساعت، عنوان، نوع (کار/رویداد) و در صورت وجود مکان.
- تداخل زمانی را خودت تشخیص بده: اگر دو آیتم در یک روز ساعت‌های هم‌پوشان دارند، به کاربر هشدار بده و پیشنهاد جابه‌جایی یا لغو یکی را بده.
- پیشنهاد مسافرت: وقتی کاربر می‌پرسد چه زمانی برای سفر خوب است، تعطیلات رسمی نزدیک + تعداد کارهای آن روزها + روزهای هفته را با هم ترکیب کن و ۲-۳ بازه پیشنهادی با دلیل بده.
- اطلاعات زنده: برای سؤال‌های دنیای واقعی (بازی بعدی پرسپولیس، قرعه‌کشی، قیمت‌ها و...) از ابزار web_search استفاده کن. بعد از پیدا کردن جواب، اگر مرتبط است، پیشنهاد بده آن را به‌عنوان رویداد با یادآوری ثبت کنی و در clarify گزینه بده.
- خودت از پیام کاربر تشخیص بده چیزی که گفته «کار» است یا «رویداد» (کار = to-do مثل خرید، مطالعه، پرداخت قبض؛ رویداد = قرار با ساعت مثل جلسه، بازی، دکتر). اگر لازم بود ثبتش کنی، intent بساز.
- هر پیشنهاد/جواب باید «متناسب با داده‌های واقعی او» باشد؛ به تاریخ‌ها و ساعت‌های context وفادار بمان و تاریخ از خودت نساز.

پاسخ را «فقط» به صورت JSON معتبر با این ساختار برگردان (بدون هیچ متن اضافه):
{
  "reply": "متن پاسخ فارسی به کاربر — محاوره‌ای، گرم و مفید",
  "intent": null یا یک شیء دستور,
  "needsConfirmation": true/false,
  "clarify": null یا { "quickReplies": ["گزینه ۱","گزینه ۲"], "needsDatePicker": false, "needsTimePicker": false, "needsReminderPicker": false, "needsPriorityPicker": false, "partialIntent": null یا شیء }
}

انواع دستور (فیلد action در intent):
- create_task: { action:"create_task", title, date:"YYYY-MM-DD" میلادی ISO, time:"HH:mm" اختیاری, priority:"low"|"medium"|"high", category:"work"|"personal"|"health"|"finance"|"education"|"social"|"other", reminder (دقیقه اختیاری), recurrence:"none"|"daily"|"weekly"|"monthly"|"yearly" }
- create_event: { action:"create_event", title, date:"YYYY-MM-DD" میلادی ISO, startTime:"HH:mm", endTime:"HH:mm" اختیاری, location اختیاری, category, reminder }
- complete_task: { action:"complete_task", id }
- delete_task: { action:"delete_task", id }
- reschedule_task: { action:"reschedule_task", id, date:"YYYY-MM-DD", time:"HH:mm" اختیاری }
- find_free_time: { action:"find_free_time", date:"YYYY-MM-DD" اختیاری, durationMinutes اختیاری }
- show_day: { action:"show_day", date:"YYYY-MM-DD" } — برنامه یک روز مشخص
- show_today / show_upcoming / summarize_week: { action:"..." }

قواعد مهم:
- تاریخ‌های متن فارسی را با کمک context جلالی به ISO میلادی تبدیل کن؛ اگر معلوم نبود، همان روز است و تذکر بده.
- عنوان intent، «عنوان اصلی» است نه جمله کامل کاربر («فردا ساعت ۱۰ جلسه دارم» → title:"جلسه").
- اگر اطلاعات کافی نیست، intent را null بده و در clarify گزینه‌های سریع بده.
- برای ایجاد یا حذف، needsConfirmation را true بگذار تا کاربر با دکمه «ثبت کن» تأیید کند.
- چت آزاد هم بخشی از نقش توست؛ سؤال‌های عمومی برنامه‌ریزی را مستقیم جواب بده (intent:null).`;

export async function callLLM(
  messages: ChatMessage[],
  tasks: Task[],
  events: CalendarEvent[],
  holidays: Holiday[],
  opts?: { preferences?: import('@/types/calendar').UserPreferences | null; profile?: { fullName?: string; jobTitle?: string; organization?: string } | null },
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
    userProfile: {
      name: opts?.profile?.fullName ?? null,
      role: opts?.profile?.jobTitle ?? null,
      organization: opts?.profile?.organization ?? null,
      workStart: opts?.preferences?.workStart ?? '08:00',
      workEnd: opts?.preferences?.workEnd ?? '20:00',
      workDays: opts?.preferences?.workDays ?? [0, 1, 2, 3, 4],
      notes: 'برنامه‌ریزی را داخل بازه ساعات کاری و روزهای کاری این کاربر بگذار مگر خودش خلافش را بخواهد.',
    },
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
      allow_tools: true,
    });

    const content = (
      data?.choices?.[0]?.message?.content ??
      data?.content ??
      data?.data?.choices?.[0]?.message?.content ??
      data?.data?.content ??
      ''
    ) as string;
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
