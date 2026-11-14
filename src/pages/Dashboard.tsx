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
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useAuthStore } from '@/store/authStore';
import { getTodaySchedule, formatFreeTime } from '@/services/calendar/schedulingEngine';
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
import type { CalendarEvent } from '@/types/calendar';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function Dashboard() {
  const setPage = useAppStore((s) => s.setPage);
  const tasks = useCalendarStore((s) => s.tasks);
  const events = useCalendarStore((s) => s.events);
  const holidays = useCalendarStore((s) => s.holidays);
  const preferences = useCalendarStore((s) => s.preferences);
  const addTask = useCalendarStore((s) => s.addTask);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const toggleTask = useCalendarStore((s) => s.toggleTask);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const skipTask = useCalendarStore((s) => s.skipTask);
  const user = useAuthStore((s) => s.user);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  const today = getTodayJalali();
  const todayISO = getTodayISO();
  const prefs = preferences;
  const greetingName = user?.full_name ? user.full_name.split(' ')[0] : null;

  const schedule = useMemo(
    () => getTodaySchedule(events, tasks, prefs?.workStart ?? '08:00', prefs?.workEnd ?? '20:00'),
    [events, tasks, prefs],
  );

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === todayISO && t.status === 'pending'),
    [tasks, todayISO],
  );

  const todayEvents = useMemo(() => events.filter((e) => e.date === todayISO), [events, todayISO]);

  const aiSummary = useMemo(
    () => calendarAi.generateDailySummary(todayTasks.length, todayEvents.length, schedule.freeMinutes),
    [todayTasks.length, todayEvents.length, schedule.freeMinutes],
  );

  const todayHoliday = useMemo(
    () => holidays.find((h) => h.gregorianDate === todayISO) ?? null,
    [holidays, todayISO],
  );

  const stats = [
    { label: 'کارهای امروز', value: toFaDigits(String(todayTasks.length)), icon: ListTodo, cls: 'bg-indigo-50 text-indigo-600' },
    { label: 'رویدادهای امروز', value: toFaDigits(String(todayEvents.length)), icon: CalendarDays, cls: 'bg-sky-50 text-sky-600' },
    { label: 'زمان آزاد', value: formatFreeTime(schedule.freeMinutes), icon: Coffee, cls: 'bg-teal-50 text-teal-600' },
  ];

  const g = getGregorianForJalali(today);
  const hijri = formatHijri(getHijriForDate(g.gy, g.gm, g.gd));

  return (
    <div className="space-y-6">
      {/* Hero greeting */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="hero-workflow relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-xl shadow-slate-950/20"
      >
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-16 bottom-0 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-teal-300 text-sm mb-2">
            <Sparkles className="h-4 w-4" />
            {formatJalali(today, 'full')}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">
            {greetingName ? `سلام، ${greetingName}` : 'تقویم هوشمند'}
          </h2>
          <p className="text-teal-100 text-sm sm:text-base max-w-md leading-relaxed" dir="ltr" style={{ textAlign: 'right' }}>
            {hijri}
          </p>

          {todayHoliday && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-amber-200 backdrop-blur-sm">
              <PartyPopper className="h-4 w-4 shrink-0" />
              <span>
                {todayHoliday.title}
                {todayHoliday.isOfficialHoliday ? ' — تعطیل رسمی' : ''}
              </span>
            </div>
          )}

          {/* Quick actions */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => setTaskModalOpen(true)}
              className="group flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm transition-all hover:bg-white/20"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30 transition-transform group-hover:scale-110">
                <Plus className="h-5 w-5" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm font-bold text-white">کار جدید</p>
                <p className="text-[11px] text-teal-200 mt-0.5">ثبت سریع کار</p>
              </div>
            </button>
            <button
              onClick={() => setEventModalOpen(true)}
              className="group flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm transition-all hover:bg-white/20"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-lg shadow-sky-500/30 transition-transform group-hover:scale-110">
                <Plus className="h-5 w-5" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm font-bold text-white">رویداد جدید</p>
                <p className="text-[11px] text-teal-200 mt-0.5">جلسه یا قرار</p>
              </div>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              custom={i + 1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="glass rounded-2xl p-4 sm:p-5 shadow-glass"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.cls} mb-3`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Today timeline */}
      <motion.section
        custom={3}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="glass rounded-2xl p-5 shadow-glass"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Clock className="h-4 w-4 text-indigo-500" />
            برنامه امروز
          </h3>
          <button
            onClick={() => setPage('calendar')}
            className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 font-medium"
          >
            تقویم
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
        {schedule.items.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">
            امروز برنامه‌ای ثبت نشده — روزت خالیه!
          </p>
        ) : (
          <div className="space-y-2">
            {schedule.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="w-12 text-center text-[11px] font-medium text-slate-500">
                  {toFaDigits(item.time)}
                </span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <div className="flex-1 truncate rounded-xl bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700">
                  {item.title}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Smart summary */}
      <motion.section
        custom={4}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="rounded-3xl bg-gradient-to-br from-indigo-600 to-teal-700 p-5 text-white shadow-lg shadow-indigo-500/20"
      >
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4" />
          خلاصه هوشمند امروز
        </div>
        <p className="whitespace-pre-line text-sm leading-6 text-indigo-100">{aiSummary}</p>
        <button
          onClick={() => setPage('assistant')}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 py-2.5 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          <Zap className="h-3.5 w-3.5" />
          گفتگو با دستیار هوشمند
        </button>
      </motion.section>

      {/* Today tasks */}
      <motion.section
        custom={5}
        variants={fadeUp}
        initial="hidden"
        animate="show"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <ListTodo className="h-4 w-4 text-teal-600" />
            کارهای امروز
          </h3>
          <button
            onClick={() => setPage('tasks')}
            className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 font-medium"
          >
            همه کارها
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
        {todayTasks.length === 0 ? (
          <p className="rounded-2xl bg-white/60 p-4 text-center text-sm text-slate-400">
            کاری برای امروز ثبت نشده
          </p>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={(t) => toggleTask(t.id)}
                onDelete={deleteTask}
                onSkip={skipTask}
              />
            ))}
          </div>
        )}
      </motion.section>

      <TaskModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} onSave={addTask} defaultDate={todayISO} />
      <EventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onSave={(e: Partial<CalendarEvent>) => addEvent(e)}
        defaultDate={todayISO}
      />
    </div>
  );
}
