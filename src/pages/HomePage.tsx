import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Sparkles, Plus, Clock, ListTodo, CalendarDays, Coffee } from 'lucide-react';
import { useCalendarStore } from '@/store/calendarStore';
import type { Task } from '@/types/calendar';
import { getTodaySchedule, formatFreeTime, getVisibleTasksForDate } from '@/services/calendar/schedulingEngine';
import { calendarAi } from '@/services/calendar/calendarAi';
import { TaskCard } from '@/components/calendar/TaskCard';
import { TaskModal } from '@/components/calendar/TaskModal';
import { getTodayJalali, getTodayISO, formatJalali, toFaDigits } from '@/utils/jalaliDate';

export function HomePage() {
  const tasks = useCalendarStore((s) => s.tasks);
  const events = useCalendarStore((s) => s.events);
  const preferences = useCalendarStore((s) => s.preferences);
  const addTask = useCalendarStore((s) => s.addTask);
  const updateTask = useCalendarStore((s) => s.updateTask);
  const toggleTask = useCalendarStore((s) => s.toggleTask);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const skipTask = useCalendarStore((s) => s.skipTask);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const today = getTodayJalali();
  const todayISO = getTodayISO();
  const prefs = preferences;

  const visibleToday = useMemo(() => getVisibleTasksForDate(tasks, todayISO), [tasks, todayISO]);
  const schedule = useMemo(
    () => getTodaySchedule(events, visibleToday, prefs?.workStart ?? '08:00', prefs?.workEnd ?? '20:00'),
    [events, visibleToday, prefs],
  );

  const todayTasks = useMemo(
    () => getVisibleTasksForDate(tasks, todayISO).filter((t) => t.status === 'pending'),
    [tasks, todayISO],
  );

  const todayEvents = useMemo(() => events.filter((e) => e.date === todayISO), [events, todayISO]);

  const aiSummary = useMemo(
    () => calendarAi.generateDailySummary(todayTasks.length, todayEvents.length, schedule.freeMinutes),
    [todayTasks.length, todayEvents.length, schedule.freeMinutes],
  );

  const stats = [
    { label: 'کارهای امروز', value: String(todayTasks.length), icon: ListTodo, cls: 'bg-primary-50 text-primary-600' },
    { label: 'رویدادهای امروز', value: String(todayEvents.length), icon: CalendarDays, cls: 'bg-accent-50 text-accent-600' },
    { label: 'زمان آزاد', value: formatFreeTime(schedule.freeMinutes), icon: Coffee, cls: 'bg-cyan-50 text-cyan-600' },
  ];

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h2 className="text-2xl font-bold text-slate-800">سلام 👋</h2>
        <p className="text-sm text-slate-500">{formatJalali(today, 'full')}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card-base grid grid-cols-3 gap-2 rounded-3xl p-4"
      >
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex flex-col items-center gap-1 text-center">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.cls}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                {/^\d+$/.test(s.value) ? toFaDigits(s.value) : s.value}
              </p>
              <p className="text-[10px] text-slate-400">{s.label}</p>
            </div>
          );
        })}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={() => setModalOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-right text-sm text-slate-400 transition-colors hover:border-primary-400 hover:text-primary-600"
      >
        <Plus className="h-4 w-4" />
        کار جدید ثبت کن...
      </motion.button>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <Clock className="h-4 w-4 text-primary-600" />
          برنامه امروز
        </h3>
        {schedule.items.length === 0 ? (
          <div className="card-base rounded-2xl p-6 text-center">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">امروز برنامه‌ای ثبت نشده — روزت خالیه!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedule.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="w-12 text-center text-[11px] font-medium text-slate-500">
                  {toFaDigits(item.time)}
                </span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <div className="card-base flex-1 rounded-xl px-3 py-2.5">
                  <p className="truncate text-right text-sm text-slate-700">{item.title}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-3xl bg-gradient-to-br from-primary-800 to-accent-800 p-5 text-white shadow-lg shadow-primary-700/20"
      >
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4" />
          خلاصه هوشمند امروز
        </div>
        <p className="whitespace-pre-line text-sm leading-6 text-primary-100">{aiSummary}</p>
        <p className="mt-3 text-xs text-primary-200">
          {schedule.freeMinutes > 120
            ? 'امروز زمان خوبی داری؛ یکی از کارهای عقب‌افتاده‌ات رو انجام بده.'
            : 'امروز برنامه‌ات پُره؛ مراقب وقت استراحتت باش.'}
        </p>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <ListTodo className="h-4 w-4 text-accent-600" />
          کارهای امروز
        </h3>
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
                onEdit={(t) => { setEditingTask(t); setModalOpen(true); }}
              />
            ))}
          </div>
        )}
      </motion.section>

      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        onSave={(t) => {
          if (editingTask) updateTask(editingTask.id, t);
          else addTask(t);
        }}
        task={editingTask}
        defaultDate={todayISO}
      />
    </div>
  );
}

