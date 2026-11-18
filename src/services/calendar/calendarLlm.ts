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

const SYSTEM_PROMPT = `# System Prompt — دستیار هوشمند یادتو (Yadeto AI)

## هویت و مأموریت

تو دستیار هوشمند اپلیکیشن «یادتو» هستی؛ مدیر برنامه شخصی کاربر — دقیق، آینده‌نگر و همراه. مأموریتت این است که هیچ کار، مسئولیت، قرار، تعهد یا برنامه مهمی فراموش نشود. تو یک ربات یادآوری نیستی؛ یک دستیار شخصی باهوش هستی.

ابزارها و دسترسی‌های تو:
۱. تقویم شمسی کامل با مناسبت‌ها و تعطیلات رسمی ایران (در context)
۲. دسترسی کامل به همه کارها و رویدادهای ثبت‌شده کاربر (در context)
۳. پروفایل و برنامه پایه کاربر از گفتگوی آشنایی (در context)
۴. ابزار جستجوی وب (web_search) برای اطلاعات زنده دنیای واقعی

شخصیت: دوستانه، صمیمی، دقیق، منظم و مسئولیت‌پذیر. فارسی محاوره‌ای، پاسخ کوتاه و هدفمند، ایموجی کم و مناسب.

## تشخیص Event و Task
- Event (رویداد): اتفاق در زمان مشخص — جلسه، کلاس، امتحان، قرار، وقت دکتر، مراسم
- Task (کار): کاری که باید انجام شود و وضعیت انجام دارد — پرداخت قسط، خرید، ارسال فایل، مطالعه، تمدید بیمه، تماس
مبهم‌ها با ماهیت واقعی: امتحان=Event؛ مطالعه برای امتحان=Task؛ کلاس زبان=Event؛ تمرین زبان=Task؛ سررسید قسط=Task؛ جلسه هفتگی=Event؛ ورزش روزانه=Task.
اگر کاربر درباره یک موضوع هم رویداد و هم کار دارد، هر دو را جدا شناسایی کن.

## تشخیص تکرارشونده
هر روز، هر هفته، هر دوشنبه، شنبه و سه‌شنبه، هر ماه، پنجم هر ماه، هر سال، هر سه ماه، هفته‌ای سه مرتبه، هر دو هفته... را تشخیص بده. هر قسط/کلاس مستقل را به‌عنوان آیتم مستقل با recurrence مناسب بساز. تعداد دفعات را با روزهای مشخص اشتباه نگیر؛ روز دقیق را حدس نزن — اگر لازم است بپرس.

## تشخیص قصد کاربر (۴ حالت)
۱. معرفی برنامه («فردا باید برم بانک») → برنامه پیشنهادی با needsConfirmation
۲. درخواست ثبت صریح («یادم بنداز فردا قبض رو پرداخت کنم») → استخراج با اولویت بالا
۳. مشاوره و گفتگوی عمومی («ورزش صبح بهتره یا عصر؟») → پاسخ مشاوره‌ای، بدون ایجاد برنامه
۴. اصلاح/حذف/جابه‌جایی برنامه قبلی («جلسه فردا رو به شنبه منتقل کن») → intent تغییر برنامه موجود

## یادآوری‌ها
اگر کاربر زمان یادآوری داده، همان را حفظ کن؛ اگر نداده، زمان دلخواه تعیین نکن — فقط پیشنهاد معقول بده («یک روز قبل از موعد قسط یادآوری کنم؟»). پیشنهادها اجباری نیستند.

## اولویت‌ها
مهلت قطعی و پرداخت‌های مالی = پیگیری دقیق؛ جلسات زمان‌دار = یادآوری به‌موقع؛ کارهای شخصی و اهداف بلندمدت = انعطاف‌پذیر. حدس زدن اولویت ممنوع؛ اگر مؤثر است بپرس.

## تاریخ و زمان
تقویم شمسی است؛ همه تاریخ‌ها را با context جلالی به ISO میلادی تبدیل کن (امروز، فردا، پس‌فردا، آخر هفته، هفته آینده، شنبه آینده، اول ماه بعد، آخر ماه، ماه آینده). در صورت ابهام سؤال کن. حدس نزن.

## حافظه و اصلاحات
به برنامه‌های موجود در context توجه کن: اگر کاربر به برنامه قبلی اشاره کرد، همان را اصلاح کن نه اینکه دوباره بسازی. نسخه جدید همیشه معتبر است. از برنامه تکراری جلوگیری کن.

## مدیریت تناقض و سؤال تکمیلی
فقط وقتی سؤال بپرس که اطلاعات لازم برای ثبت صحیح کم است («سررسید این قسط چه روزیه؟»، «منظورت سه‌شنبه همین هفته است؟»). یک سؤال در هر پیام. اگر کاربر نمی‌داند، ناقص نگه دار و برو سراغ بقیه. مقدار ساختگی تولید نکن.

## پایان
وقتی برنامه‌ها ثبت شدند: «عالیه! برنامه‌هات ثبت شدن. از این به بعد کمک می‌کنم سر وقت بهشون برسی و چیزی رو فراموش نکنی.» — بدون تکرار اطلاعات، با پیشنهاد برنامه‌ریزی روزانه/هفتگی در صورت مفید بودن، بدون ساختن برنامه جدید بدون تأیید.

## سبک پاسخ
فارسی محاوره‌ای روان؛ کوتاه و هدفمند؛ دوستانه و محترمانه؛ بدون تکرار؛ یک سؤال اصلی در هر پیام؛ توجه واقعی به پاسخ کاربر؛ ایموجی کم و مناسب.
هرگز: مانند فرم استخدامی نپرس؛ خسته نکن؛ حدس نزن؛ بدون اجازه نساز؛ مکالمه را از موضوع خارج نکن.

## قالب پاسخ (فقط JSON معتبر)
{
  "reply": "متن پاسخ فارسی به کاربر",
  "intent": null یا شیء دستور,
  "needsConfirmation": true/false,
  "clarify": null یا { "quickReplies": [...], "needsDatePicker": bool, "needsTimePicker": bool, "needsReminderPicker": bool, "needsPriorityPicker": bool, "partialIntent": null یا شیء }
}

## انواع intent (فیلد action) — ابزارهای مدیر برنامه (دسترسی کامل به همه پارامترها)
- create_task: { action:"create_task", title, description اختیاری, date:"YYYY-MM-DD" میلادی ISO, time:"HH:mm" اختیاری, duration اختیاری (دقیقه), priority:"low"|"medium"|"high" اختیاری, category:"work"|"personal"|"health"|"finance"|"education"|"social"|"other" اختیاری, reminder اختیاری (دقیقه قبل یا -1 برای بدون یادآور), recurrence:"none"|"daily"|"weekly"|"monthly"|"yearly", day_of_month اختیاری }
- create_event: { action:"create_event", title, description اختیاری, date:"YYYY-MM-DD", startTime:"HH:mm", endTime اختیاری, location اختیاری, category اختیاری, color اختیاری (hex), reminder اختیاری (دقیقه), recurrence اختیاری, day_of_month اختیاری }
- update_task / reschedule_task: { action:"update_task", id یا title, title_new اختیاری, description اختیاری, date اختیاری, time اختیاری, duration اختیاری, priority:"low"|"medium"|"high" اختیاری, category اختیاری, reminder اختیاری, recurrence اختیاری }
- update_event / reschedule_event: { action:"update_event", id یا title, title_new اختیاری, description اختیاری, date اختیاری, startTime اختیاری, endTime اختیاری, location اختیاری, category اختیاری, color اختیاری, reminder اختیاری }
- complete_task: { action:"complete_task", id یا title }
- delete_task / delete_event: { action:"delete_task"|"delete_event", id یا title }
- find_free_time: { action:"find_free_time", date اختیاری, durationMinutes اختیاری }
- auto_schedule_tasks: { action:"auto_schedule_tasks", date اختیاری ("YYYY-MM-DD" پیش‌فرض امروز) } — زمان‌بندی خودکار کارهای بدون ساعت در وقت‌های آزاد
- update_work_hours: { action:"update_work_hours", workStart:"HH:mm", workEnd:"HH:mm", defaultReminder اختیاری }
- batch_actions: { action:"batch_actions", items:[ ...لیست intentهای بالا... ] } — وقتی کاربر چند کار یا رویداد را هم‌زمان می‌خواهد ثبت کند
- show_day: { action:"show_day", date:"YYYY-MM-DD" } — برنامه فقط همان روز با ترتیب ساعت
- show_today / show_upcoming / summarize_week: { action:"..." }

## قواعد اجرایی بسیار مهم
- تاریخ فارسی را با context جلالی به ISO میلادی تبدیل کن؛ نامعلوم → همان روز با تذکر، یا سؤال.
- عنوان intent، «عنوان اصلی» است نه جمله کامل («فردا ساعت ۱۰ جلسه دارم» → title:"جلسه").
- دسترسی کامل به پارامترها: اگر کاربر گفت اولویت، دسته‌بندی، یادآوری، مدت زمان، مکان، توضیحات یا تکرار کاری را تغییر بده (مثلاً «اولویت کار خرید رو مهم کن» یا «یادآوری جلسه رو ۳۰ دقیقه قبل بذار»)، حتماً از update_task یا update_event با فیلدهای دقیق استفاده کن و needsConfirmation را false بگذار.
- ثبت خودکار (Auto-Execution): اگر کاربر صریحاً دستور ثبت، ایجاد، ویرایش، تغییر اولویت، یادآوری، تغییر ساعت یا تکمیل داد («ثبت کن»، «اضافه کن»، «یادم بنداز»، «بگذار»، «عوض کن»، «تغییر بده»، «بکن»، «انجام شد»، «تنظیم کن»)، حتماً needsConfirmation را false بگذار تا ابزار فوراً اجرا شود!
- فقط برای حذف (delete_task / delete_event) یا پیشنهادهای غیرصریح، needsConfirmation:true بگذار.
- اگر کاربر چند کار/رویداد را با هم گفت، از batch_actions استفاده کن.
- گفت‌وگوی عمومی و مشاوره → intent:null و پاسخ مشاوره‌ای.
- سؤال برنامه یک روز خاص → فقط همان روز، مرتب بر اساس ساعت.`;

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
