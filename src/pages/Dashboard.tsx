import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Plus,
  Clock,
  ListTodo,
  CalendarDays,
  ArrowLeft,
  CheckCircle2,
  PartyPopper,
  CalendarPlus,
  Send,
  Mic,
  StickyNote,
  Pin,
  AlertCircle,
  Bot,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useCalendarStore } from '@/store/calendarStore';
import { getTodaySchedule, getVisibleTasksForDate } from '@/services/calendar/schedulingEngine';
import { TaskCard } from '@/components/calendar/TaskCard';
import { TaskModal } from '@/components/calendar/TaskModal';
import { EventModal } from '@/components/calendar/EventModal';
import type { Task, CalendarEvent } from '@/types/calendar';
import {
  JALALI_MONTHS,
  getTodayJalali,
  getTodayISO,
  formatJalali,
  toFaDigits,
  getGregorianForJalali,
  formatGregorian,
  getHijriForDate,
  formatHijri,
} from '@/utils/jalaliDate';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
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
  const launchAiVoice = useAppStore((s) => s.launchAiVoice);
  const tasks = useCalendarStore((s) => s.tasks);
  const events = useCalendarStore((s) => s.events);
  const notes = useCalendarStore((s) => s.notes);
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

  const overdueTasks = useMemo(
    () => tasks.filter((t) => t.status === 'pending' && t.dueDate < todayISO),
    [tasks, todayISO],
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

  const recentNotes = useMemo(() => notes.slice(0, 3), [notes]);

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

  // Progress ring math
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div className="space-y-5">
      {/* Top Executive Day & AI Card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary-950 to-slate-950 p-5 sm:p-6 text-white shadow-premium border border-white/10"
      >
        <div className="relative z-10 space-y-4">
          {/* Date + Greeting + Progress */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Bold Day Badge */}
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-lg shadow-primary-600/30">
                <span className="text-2xl font-black leading-none">{toFaDigits(today.day)}</span>
                <span className="mt-1 text-[11px] font-bold text-white/90">
                  {JALALI_MONTHS[today.month - 1]}
                </span>
              </div>

              <div className="min-w-0 space-y-1">
                <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight truncate">
                  {greetingName ? `${getTimeGreeting()}، ${greetingName}` : `${getTimeGreeting()}!`}
                </h2>
                <p className="text-xs text-accent-300 font-medium truncate">
                  {formatJalali(today, 'full')}
                </p>
                <p className="text-[10px] text-slate-400 truncate" dir="ltr" style={{ textAlign: 'right' }}>
                  {gregorian} • {hijri}
                </p>
              </div>
            </div>

            {/* Compact Progress Ring */}
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/8 border border-white/10 px-3 py-2 backdrop-blur-md shrink-0">
              <div className="relative h-14 w-14 flex items-center justify-center">
                <svg className="h-14 w-14 -rotate-90" viewBox="0 0 60 60">
                  <circle
                    cx="30"
                    cy="30"
                    r={radius}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="4.5"
                    fill="none"
                  />
                  <motion.circle
                    cx="30"
                    cy="30"
                    r={radius}
                    stroke="#2dd4bf"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 0.85, ease: 'easeOut' }}
                  />
                </svg>
                <span className="absolute text-[11px] font-extrabold text-white">
                  {toFaDigits(String(progressPct))}٪
                </span>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-white">پیشرفت امروز</p>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  {totalToday > 0
                    ? `${toFaDigits(String(completedToday))} از ${toFaDigits(String(totalToday))} کار`
                    : 'بدون کار ثبت‌شده'}
                </p>
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

          {/* Voice + Text AI Command Bar */}
          <form onSubmit={handleAiSubmit}>
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 p-1.5 backdrop-blur-md focus-within:bg-white/15 focus-within:border-accent-400/50 transition-all">
              <button
                type="button"
                onClick={launchAiVoice}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-primary-500 text-white shadow-md transition-transform active:scale-95 hover:scale-105"
                title="مکالمه صوتی با دستیار"
                aria-label="مکالمه صوتی با دستیار"
              >
                <Mic className="h-5 w-5" />
              </button>
              <input
                type="text"
                value={aiCommand}
                onChange={(e) => setAiCommand(e.target.value)}
                placeholder="به یادتو بگو یا بنویس... مثلاً «ساعت ۱۷ جلسه دارم»"
                className="flex-1 bg-transparent px-2 py-2 text-xs sm:text-sm text-white placeholder:text-slate-300/75 focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 px-3.5 py-2 text-xs font-bold text-white transition-colors shrink-0"
              >
                <Bot className="h-4 w-4 text-accent-300 hidden sm:block" />
                <Send className="h-4 w-4 -scale-x-100" />
              </button>
            </div>
          </form>
        </div>
      </motion.section>

      {/* Quick Actions Strip */}
      <motion.section
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-2.5"
      >
        <button
          onClick={() => { setEditingTask(null); setTaskModalOpen(true); }}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all hover:border-primary-300 hover:shadow-md active:scale-95"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-bold text-slate-700">کار جدید</span>
        </button>

        <button
          onClick={() => { setEditingEvent(null); setEventModalOpen(true); }}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all hover:border-accent-300 hover:shadow-md active:scale-95"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
            <CalendarPlus className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-bold text-slate-700">رویداد جدید</span>
        </button>

        <button
          onClick={() => setPage('notes')}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition-all hover:border-amber-300 hover:shadow-md active:scale-95"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <StickyNote className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-bold text-slate-700">یادداشت</span>
        </button>

        <button
          onClick={launchAiVoice}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-primary-100 bg-gradient-to-b from-primary-50/60 to-accent-50/40 p-3 shadow-sm transition-all hover:border-primary-300 hover:shadow-md active:scale-95"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-accent-500 text-white shadow-sm">
            <Mic className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-bold text-primary-800">دستیار صوتی</span>
        </button>
      </motion.section>

      {/* Overdue Alert Banner (if any) */}
      {overdueTasks.length > 0 && (
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          onClick={() => setPage('tasks')}
          className="cursor-pointer flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-800 hover:bg-rose-100/70 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-bold">
              {toFaDigits(String(overdueTasks.length))} کار عقب‌افتاده از روزهای قبل دارید
            </span>
          </div>
          <span className="font-semibold text-rose-700 flex items-center gap-1 shrink-0">
            بررسی
            <ArrowLeft className="h-3.5 w-3.5" />
          </span>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Right Column (7 cols): Today's Tasks + Timeline */}
        <div className="lg:col-span-7 space-y-5">
          {/* Priority Today Tasks */}
          <motion.section
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="card-premium rounded-3xl p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <ListTodo className="h-5 w-5 text-primary-600" />
                کارهای امروز
                {todayTasks.length > 0 && (
                  <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-bold text-primary-700">
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
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success-500/75" />
                <p className="text-sm font-semibold text-slate-700">همه کارهای امروز انجام شده یا ثبت نشده!</p>
                <button
                  onClick={() => { setEditingTask(null); setTaskModalOpen(true); }}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl bg-primary-50 px-3.5 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  افزودن کار جدید
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
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
                    className="w-full rounded-xl bg-slate-50 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    مشاهده {toFaDigits(String(todayTasks.length - 5))} کار دیگر
                  </button>
                )}
              </div>
            )}
          </motion.section>

          {/* Visual Day Schedule */}
          <motion.section
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="card-premium rounded-3xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <Clock className="h-5 w-5 text-accent-600" />
                برنامه زمان‌بندی امروز
              </h3>
              <button
                onClick={() => setPage('calendar')}
                className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                تقویم کامل
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>

            {schedule.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center space-y-2">
                <CalendarDays className="mx-auto h-7 w-7 text-slate-400" />
                <p className="text-xs font-medium text-slate-500">
                  امروز هنوز رویداد یا کار زمان‌داری ثبت نشده است.
                </p>
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
          </motion.section>
        </div>

        {/* Left Column (5 cols): Summary Stats + Recent Notes */}
        <div className="lg:col-span-5 space-y-5">
          {/* 2-Card Summary (No Free Time) */}
          <motion.div
            custom={5}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-3"
          >
            <div
              onClick={() => setPage('tasks')}
              className="cursor-pointer card-base rounded-2xl p-4 transition-all hover:shadow-card-hover"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100 mb-2.5">
                <ListTodo className="h-5 w-5" />
              </div>
              <p className="text-2xl font-black text-slate-900">{toFaDigits(String(todayTasks.length))}</p>
              <p className="text-xs font-bold text-slate-700 mt-0.5">کارهای باقی‌مانده</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {completedToday > 0 ? `${toFaDigits(String(completedToday))} انجام شده` : 'برای امروز'}
              </p>
            </div>

            <div
              onClick={() => setPage('calendar')}
              className="cursor-pointer card-base rounded-2xl p-4 transition-all hover:shadow-card-hover"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600 border border-accent-100 mb-2.5">
                <CalendarDays className="h-5 w-5" />
              </div>
              <p className="text-2xl font-black text-slate-900">{toFaDigits(String(todayEvents.length))}</p>
              <p className="text-xs font-bold text-slate-700 mt-0.5">رویدادهای امروز</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {todayEvents[0] ? `اولین: ${toFaDigits(todayEvents[0].startTime)}` : 'برنامه‌ای نیست'}
              </p>
            </div>
          </motion.div>

          {/* Recent & Pinned Notes Card */}
          <motion.section
            custom={6}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="card-premium rounded-3xl p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <StickyNote className="h-5 w-5 text-amber-500" />
                یادداشت‌های من
              </h3>
              <button
                onClick={() => setPage('notes')}
                className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                همه یادداشت‌ها
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>

            {recentNotes.length === 0 ? (
              <div className="rounded-2xl bg-amber-50/50 border border-amber-100 p-5 text-center space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  هنوز یادداشتی ثبت نکرده‌اید. نکات مهم را بنویسید تا هوش مصنوعی هم به خاطر بسپارد!
                </p>
                <button
                  onClick={() => setPage('notes')}
                  className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  ثبت یادداشت
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentNotes.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => setPage('notes')}
                    className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-3.5 hover:border-amber-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                        {n.pinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-400 shrink-0" />}
                        {n.title}
                      </span>
                      {n.category && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 shrink-0">
                          {n.category}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-5">
                      {n.content || 'بدون متن...'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          {/* AI Assistant Promo Card */}
          <motion.section
            custom={7}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-800 to-accent-800 p-5 text-white shadow-lg shadow-primary-900/20"
          >
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-accent-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  دستیار هوشمند یادتو
                </div>
                <p className="text-xs text-primary-100 leading-5">
                  با صدای خودت کارها، رویدادها و یادداشت‌ها را مدیریت کن.
                </p>
              </div>
              <button
                onClick={launchAiVoice}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-lg transition-transform hover:scale-105 active:scale-95"
                title="شروع مکالمه صوتی"
              >
                <Mic className="h-5 w-5" />
              </button>
            </div>
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
