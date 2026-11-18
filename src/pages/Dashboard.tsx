import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Plus,
  Clock,
  ListTodo,
  CalendarDays,
  Coffee,
  PartyPopper,
  ArrowLeft,
  Zap,
  CheckCircle2,
  Send,
  Wand2,
  CalendarPlus,
  Bot,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useAuthStore } from '@/store/authStore';
import {
  getTodaySchedule,
  formatFreeTime,
  getVisibleTasksForDate,
  findFreeSlots,
} from '@/services/calendar/schedulingEngine';
import { calendarAi } from '@/services/calendar/calendarAi';
import { TaskCard } from '@/components/calendar/TaskCard';
import { TaskModal } from '@/components/calendar/TaskModal';
import { EventModal } from '@/components/calendar/EventModal';
import {
  getTodayJalali,
  getTodayISO,
  formatJalali,
  toFaDigits,
  getHijriForDate,
  formatHijri,
  getGregorianForJalali,
  formatGregorian,
} from '@/utils/jalaliDate';
import type { CalendarEvent, Task } from '@/types/calendar';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'صبح بخیر';
  if (hour < 17) return 'ظهر بخیر';
  if (hour < 21) return 'عصر بخیر';
  return 'شب بخیر';
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function Dashboard() {
  const setPage = useAppStore((s) => s.setPage);
  const launchAiPrompt = useAppStore((s) => s.launchAiPrompt);
  const tasks = useCalendarStore((s) => s.tasks);
  const events = useCalendarStore((s) => s.events);
  const holidays = useCalendarStore((s) => s.holidays);
  const preferences = useCalendarStore((s) => s.preferences);
  const addTask = useCalendarStore((s) => s.addTask);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const toggleTask = useCalendarStore((s) => s.toggleTask);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const skipTask = useCalendarStore((s) => s.skipTask);
  const updateTask = useCalendarStore((s) => s.updateTask);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const user = useAuthStore((s) => s.user);

  const [aiCommand, setAiCommand] = useState('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const today = getTodayJalali();
  const todayISO = getTodayISO();
  const prefs = preferences;
  const greetingName = user?.full_name ? user.full_name.split(' ')[0] : null;
  const nowHHMM = getCurrentTimeHHMM();

  const visibleToday = useMemo(() => getVisibleTasksForDate(tasks, todayISO), [tasks, todayISO]);

  const schedule = useMemo(
    () => getTodaySchedule(events, visibleToday, prefs?.workStart ?? '08:00', prefs?.workEnd ?? '20:00'),
    [events, visibleToday, prefs],
  );

  const priorityRank: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 };

  const todayTasks = useMemo(
    () =>
      visibleToday
        .filter((t) => t.status === 'pending')
        .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]),
    [visibleToday],
  );

  const todayEvents = useMemo(
    () =>
      events
        .filter((e) => e.date === todayISO)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, todayISO],
  );

  const completedToday = useMemo(
    () => visibleToday.filter((t) => t.status === 'completed').length,
    [visibleToday],
  );

  const totalToday = todayTasks.length + completedToday;
  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const aiSummary = useMemo(
    () => calendarAi.generateDailySummary(todayTasks.length, todayEvents.length, schedule.freeMinutes),
    [todayTasks.length, todayEvents.length, schedule.freeMinutes],
  );

  const freeSlotsToday = useMemo(
    () =>
      findFreeSlots({
        events,
        tasks,
        holidays,
        workStart: prefs?.workStart ?? '08:00',
        workEnd: prefs?.workEnd ?? '20:00',
        workDays: prefs?.workDays ?? [6, 0, 1, 2, 3],
        durationMinutes: 45,
        daysAhead: 1,
      }).slots,
    [events, tasks, holidays, prefs],
  );

  const todayHoliday = useMemo(
    () => holidays.find((h) => h.gregorianDate === todayISO) ?? null,
    [holidays, todayISO],
  );

  const g = getGregorianForJalali(today);
  const hijri = formatHijri(getHijriForDate(g.gy, g.gm, g.gd));
  const gregorian = formatGregorian(g);

  const handleAiSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = aiCommand.trim();
    if (!trimmed) {
      setPage('assistant');
      return;
    }
    setAiCommand('');
    launchAiPrompt(trimmed);
  };

  const quickAiPrompts = [
    { label: 'برنامه‌ریزی هوشمند امروز', prompt: 'برنامه امروز رو برام بچین و اولویت‌بندی کن' },
    { label: 'بهترین زمان آزاد این هفته', prompt: 'زمان‌های آزاد این هفته برای یه کار ۱ ساعته کجاست؟' },
    { label: 'ثبت جلسه فردا', prompt: 'فردا ساعت ۱۰ صبح جلسه برنامه‌ریزی دارم' },
  ];

  const stats = [
    {
      label: 'کارهای باقی‌مانده',
      value: toFaDigits(String(todayTasks.length)),
      sub: completedToday > 0 ? `${toFaDigits(String(completedToday))} انجام شده` : 'برای امروز',
      icon: ListTodo,
      cls: 'bg-primary-50 text-primary-600 border-primary-100',
    },
    {
      label: 'رویدادهای امروز',
      value: toFaDigits(String(todayEvents.length)),
      sub: todayEvents[0] ? `اولین: ${toFaDigits(todayEvents[0].startTime)}` : 'روز خلوت',
      icon: CalendarDays,
      cls: 'bg-accent-50 text-accent-600 border-accent-100',
    },
    {
      label: 'زمان آزاد',
      value: formatFreeTime(schedule.freeMinutes),
      sub: freeSlotsToday[0] ? `بازه بعدی: ${toFaDigits(freeSlotsToday[0].startTime)}` : 'در ساعات کاری',
      icon: Coffee,
      cls: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    },
  ];

  // Progress ring math
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Executive AI Command Center Hero */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="hero-glow relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary-950 to-slate-950 p-5 sm:p-7 text-white shadow-premium border border-white/10"
      >
        <div className="relative z-10 space-y-5">
          {/* Top row: Greeting + Date + Progress Ring */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-accent-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-medium backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  {formatJalali(today, 'full')}
                </span>
                <span className="text-slate-400 hidden sm:inline">•</span>
                <span className="text-slate-300 text-[11px]" dir="ltr">
                  {gregorian}
                </span>
                <span className="text-slate-400 hidden md:inline">•</span>
                <span className="text-slate-300 text-[11px] hidden md:inline">{hijri}</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {greetingName ? `${getTimeGreeting()}، ${greetingName}` : `${getTimeGreeting()}!`}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                مدیر برنامه هوشمند آماده است — دستور بده تا روزت را بچینم.
              </p>
            </div>

            {/* Daily Progress Ring + Quick Add */}
            <div className="flex items-center gap-4 self-start sm:self-center">
              <div className="flex items-center gap-3 rounded-2xl bg-white/8 border border-white/10 px-3.5 py-2.5 backdrop-blur-md">
                <div className="relative h-16 w-16 flex items-center justify-center">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 68 68">
                    <circle
                      cx="34"
                      cy="34"
                      r={radius}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="5"
                      fill="none"
                    />
                    <motion.circle
                      cx="34"
                      cy="34"
                      r={radius}
                      stroke="#2dd4bf"
                      strokeWidth="5"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                    />
                  </svg>
                  <span className="absolute text-xs font-bold text-white">
                    {toFaDigits(String(progressPct))}٪
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-white">پیشرفت امروز</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {totalToday > 0
                      ? `${toFaDigits(String(completedToday))} از ${toFaDigits(String(totalToday))} کار`
                      : 'هنوز کاری ثبت نشده'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {todayHoliday && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-400/25 px-3.5 py-2 text-xs text-amber-200">
              <PartyPopper className="h-4 w-4 shrink-0 text-amber-300" />
              <span>
                {todayHoliday.title}
                {todayHoliday.isOfficialHoliday ? ' — تعطیل رسمی' : ''}
              </span>
            </div>
          )}

          {/* Embedded AI Command Bar */}
          <form onSubmit={handleAiSubmit} className="space-y-2.5">
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 p-1.5 backdrop-blur-md focus-within:bg-white/15 focus-within:border-accent-400/50 transition-all">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-primary-500 text-white shadow-md">
                <Bot className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={aiCommand}
                onChange={(e) => setAiCommand(e.target.value)}
                placeholder="به مدیر برنامه‌ات بگو... مثلاً «امروز ساعت ۱۷ جلسه با علی بگذار»"
                className="flex-1 bg-transparent px-2 py-2 text-sm text-white placeholder:text-slate-300/75 focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-accent-500 hover:bg-accent-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition-colors shrink-0"
              >
                <span className="hidden sm:inline">اجرا</span>
                <Send className="h-4 w-4 -scale-x-100" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Wand2 className="h-3 w-3 text-accent-300" />
                پیشنهاد سریع:
              </span>
              {quickAiPrompts.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => launchAiPrompt(chip.prompt)}
                  className="rounded-full bg-white/8 hover:bg-white/16 border border-white/10 px-3 py-1 text-[11px] text-slate-200 transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </form>
        </div>
      </motion.section>

      {/* Main Bento Grid: 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Right/Primary Column (7 cols): Visual Day Timeline */}
        <motion.section
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="lg:col-span-7 card-premium rounded-3xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
                <Clock className="h-5 w-5 text-primary-600" />
                برنامه زمان‌بندی امروز
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ساعت کاری: {toFaDigits(prefs?.workStart ?? '08:00')} تا {toFaDigits(prefs?.workEnd ?? '20:00')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingTask(null); setTaskModalOpen(true); }}
                className="flex items-center gap-1.5 rounded-xl bg-primary-50 hover:bg-primary-100 px-3 py-2 text-xs font-semibold text-primary-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                کار
              </button>
              <button
                onClick={() => { setEditingEvent(null); setEventModalOpen(true); }}
                className="flex items-center gap-1.5 rounded-xl bg-accent-50 hover:bg-accent-100 px-3 py-2 text-xs font-semibold text-accent-700 transition-colors"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                رویداد
              </button>
              <button
                onClick={() => setPage('calendar')}
                className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                تقویم
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {schedule.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">امروز هنوز برنامه‌ای زمان‌بندی نشده</p>
                <p className="text-xs text-slate-400 mt-1">
                  می‌تونی با دستیار هوشمند در چند ثانیه برنامه امروزت رو بچینی
                </p>
              </div>
              <button
                onClick={() => launchAiPrompt('برنامه امروز من رو بر اساس کارهای باقی‌مانده بچین')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-700 hover:bg-primary-800 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-primary-700/20 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                چیدمان با هوش مصنوعی
              </button>
            </div>
          ) : (
            <div className="relative space-y-3 pr-4 before:absolute before:right-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200/80">
              {schedule.items.map((item) => {
                const isPast = item.time < nowHHMM;
                return (
                  <div key={item.id} className="relative flex items-start gap-3 group">
                    <span
                      className="absolute -right-[13px] top-4 h-3 w-3 rounded-full ring-4 ring-white transition-transform group-hover:scale-125"
                      style={{ backgroundColor: item.color }}
                    />
                    <div
                      className={`flex-1 flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                        isPast
                          ? 'bg-slate-50/70 border-slate-200/60 opacity-75'
                          : 'bg-white border-slate-200/80 hover:border-primary-200 hover:shadow-card'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                            {toFaDigits(item.time)}
                            {item.endTime ? ` تا ${toFaDigits(item.endTime)}` : ''}
                          </span>
                          <span className="rounded-md bg-primary-50/70 px-2 py-0.5 text-primary-700 font-medium">
                            {item.type === 'event' ? 'رویداد' : 'کار'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Free slot suggestion footer */}
          {freeSlotsToday.length > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-accent-50/70 border border-accent-200/60 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <TrendingUp className="h-4 w-4 text-accent-600 shrink-0" />
                <p className="text-xs text-accent-900 truncate">
                  بازه آزاد پیشنهادی امروز:{' '}
                  <span className="font-bold">
                    {toFaDigits(freeSlotsToday[0].startTime)} تا {toFaDigits(freeSlotsToday[0].endTime)}
                  </span>
                </p>
              </div>
              <button
                onClick={() =>
                  launchAiPrompt(
                    `برای بازه آزاد ساعت ${freeSlotsToday[0].startTime} تا ${freeSlotsToday[0].endTime} امروز چه کاری پیشنهاد می‌دی؟`,
                  )
                }
                className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-accent-700 shadow-sm hover:bg-accent-100/50 transition-colors"
              >
                پیشنهاد AI
              </button>
            </div>
          )}
        </motion.section>

        {/* Left/Secondary Column (5 cols): KPIs + AI Brief + Today's Tasks */}
        <div className="lg:col-span-5 space-y-5">
          {/* KPI Mini Grid */}
          <motion.div
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="grid grid-cols-3 gap-2.5 sm:gap-3"
          >
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="card-base rounded-2xl p-3.5 transition-all hover:shadow-card-hover"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${stat.cls} mb-2.5`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-lg font-extrabold text-slate-900 truncate">{stat.value}</p>
                  <p className="text-[11px] font-medium text-slate-600 mt-0.5 truncate">{stat.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{stat.sub}</p>
                </div>
              );
            })}
          </motion.div>

          {/* AI Program Manager Brief */}
          <motion.section
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-800 via-primary-900 to-accent-900 p-5 text-white shadow-lg shadow-primary-900/20"
          >
            <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Sparkles className="h-4 w-4 text-accent-300" />
                  گزارش مدیر برنامه
                </div>
                <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-[10px] font-medium text-accent-200">
                  تحلیل هوشمند
                </span>
              </div>
              <p className="whitespace-pre-line text-xs sm:text-sm leading-6 text-primary-100">{aiSummary}</p>
              <button
                onClick={() => setPage('assistant')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 py-2.5 text-xs font-semibold transition-colors"
              >
                <Zap className="h-3.5 w-3.5 text-accent-300" />
                گفتگو با مدیر برنامه هوشمند
              </button>
            </div>
          </motion.section>

          {/* Priority Today Tasks */}
          <motion.section
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="card-premium rounded-3xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ListTodo className="h-4 w-4 text-accent-600" />
                کارهای امروز
                {todayTasks.length > 0 && (
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700">
                    {toFaDigits(String(todayTasks.length))}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setPage('tasks')}
                className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                همه کارها
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>

            {todayTasks.length === 0 ? (
              <div className="rounded-2xl bg-slate-50/80 p-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success-500/70" />
                <p className="text-sm font-medium text-slate-600">همه کارهای امروز انجام شده یا خالیه!</p>
                <button
                  onClick={() => { setEditingTask(null); setTaskModalOpen(true); }}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  افزودن کار جدید
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.slice(0, 5).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={(t) => toggleTask(t.id)}
                    onDelete={deleteTask}
                    onSkip={skipTask}
                    onEdit={(t) => { setEditingTask(t); setTaskModalOpen(true); }}
                  />
                ))}
                {todayTasks.length > 5 && (
                  <button
                    onClick={() => setPage('tasks')}
                    className="w-full rounded-xl bg-slate-50 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    مشاهده {toFaDigits(String(todayTasks.length - 5))} کار دیگر
                  </button>
                )}
              </div>
            )}
          </motion.section>
        </div>
      </div>

      <TaskModal
        open={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setEditingTask(null); }}
        onSave={(t) => {
          if (editingTask) updateTask(editingTask.id, t);
          else addTask(t);
        }}
        task={editingTask}
        defaultDate={todayISO}
      />
      <EventModal
        open={eventModalOpen}
        onClose={() => { setEventModalOpen(false); setEditingEvent(null); }}
        onSave={(e) => {
          if (editingEvent) updateEvent(editingEvent.id, e);
          else addEvent(e);
        }}
        event={editingEvent}
        defaultDate={todayISO}
      />
    </div>
  );
}
