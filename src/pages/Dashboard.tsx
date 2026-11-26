import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
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
  MapPin,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useCalendarStore } from '@/store/calendarStore';
import { getVisibleTasksForDate } from '@/services/calendar/schedulingEngine';
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

export function Dashboard() {
  const setPage = useAppStore((s) => s.setPage);
  const launchAiPrompt = useAppStore((s) => s.launchAiPrompt);
  const launchAiVoice = useAppStore((s) => s.launchAiVoice);
  const tasks = useCalendarStore((s) => s.tasks);
  const events = useCalendarStore((s) => s.events);
  const notes = useCalendarStore((s) => s.notes);
  const holidays = useCalendarStore((s) => s.holidays);
  const addTask = useCalendarStore((s) => s.addTask);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const toggleTask = useCalendarStore((s) => s.toggleTask);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const skipTask = useCalendarStore((s) => s.skipTask);
  const updateTask = useCalendarStore((s) => s.updateTask);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const user = useAuthStore((s) => s.user);

  const [aiCommand, setAiCommand] = useState('');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const today = getTodayJalali();
  const todayISO = getTodayISO();
  const greetingName = user?.full_name ? user.full_name.split(' ')[0] : null;

  const visibleToday = useMemo(() => getVisibleTasksForDate(tasks, todayISO), [tasks, todayISO]);

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

  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div className="space-y-5">
      {/* Today Header + Single AI Input */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary-950 to-slate-950 p-5 sm:p-6 text-white shadow-premium border border-white/10"
      >
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
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

          {/* Single AI Command Bar */}
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
                placeholder="از دستیار هوشمند بخواه... مثلاً «ساعت ۱۷ جلسه دارم»"
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

      {/* Overdue Alert Banner (if any) */}
      {overdueTasks.length > 0 && (
        <motion.div
          custom={1}
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

      {/* Main Content Grid — Zero Duplicate Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Right Column (7 cols): Today's Tasks */}
        <div className="lg:col-span-7 space-y-5">
          <motion.section
            custom={2}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingTask(null); setTaskModalOpen(true); }}
                  className="flex items-center gap-1 rounded-xl bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 text-xs font-bold text-primary-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  کار
                </button>
                <button
                  onClick={() => setPage('tasks')}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-primary-700"
                >
                  همه
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {todayTasks.length === 0 ? (
              <div className="rounded-2xl bg-slate-50/80 p-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success-500/75" />
                <p className="text-sm font-semibold text-slate-700">همه کارهای امروز انجام شده یا ثبت نشده!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayTasks.slice(0, 6).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={(t) => toggleTask(t.id)}
                    onDelete={deleteTask}
                    onSkip={skipTask}
                    onEdit={(t) => { setEditingTask(t); setTaskModalOpen(true); }}
                  />
                ))}
                {todayTasks.length > 6 && (
                  <button
                    onClick={() => setPage('tasks')}
                    className="w-full rounded-xl bg-slate-50 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    مشاهده {toFaDigits(String(todayTasks.length - 6))} کار دیگر
                  </button>
                )}
              </div>
            )}
          </motion.section>
        </div>

        {/* Left Column (5 cols): Today's Events + Recent Notes */}
        <div className="lg:col-span-5 space-y-5">
          {/* Today's Events (Events only — no duplicated tasks) */}
          <motion.section
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="card-premium rounded-3xl p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <CalendarDays className="h-5 w-5 text-accent-600" />
                رویدادهای امروز
                {todayEvents.length > 0 && (
                  <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-bold text-accent-700">
                    {toFaDigits(String(todayEvents.length))}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingEvent(null); setEventModalOpen(true); }}
                  className="flex items-center gap-1 rounded-xl bg-accent-50 hover:bg-accent-100 px-2.5 py-1.5 text-xs font-bold text-accent-700 transition-colors"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  رویداد
                </button>
                <button
                  onClick={() => setPage('calendar')}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-primary-700"
                >
                  تقویم
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {todayEvents.length === 0 ? (
              <div className="rounded-2xl bg-slate-50/70 p-5 text-center">
                <p className="text-xs font-medium text-slate-500">امروز رویدادی ثبت نشده است.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => { setEditingEvent(ev); setEventModalOpen(true); }}
                    className="cursor-pointer flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 hover:border-accent-300 hover:shadow-sm transition-all"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: ev.color || '#14b8a6' }}
                        />
                        <p className="truncate text-sm font-bold text-slate-800">{ev.title}</p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded-md bg-accent-50 px-2 py-0.5 font-semibold text-accent-700">
                          {toFaDigits(ev.startTime)}
                          {ev.endTime ? ` تا ${toFaDigits(ev.endTime)}` : ''}
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {ev.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEvent(ev.id);
                      }}
                      className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="حذف رویداد"
                      aria-label="حذف رویداد"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          {/* Recent & Pinned Notes Card */}
          <motion.section
            custom={4}
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
                  هنوز یادداشتی ثبت نکرده‌اید.
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
