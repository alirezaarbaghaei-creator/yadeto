import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  Plus,
  PartyPopper,
  CalendarPlus,
  Clock,
  List,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { useCalendarStore } from '@/store/calendarStore';
import { useAppStore } from '@/store/appStore';
import { MiniCalendar, toISO } from '@/components/calendar/MiniCalendar';
import { getVisibleTasksForDate, getTodaySchedule } from '@/services/calendar/schedulingEngine';
import { TaskCard } from '@/components/calendar/TaskCard';
import { EventCard } from '@/components/calendar/EventCard';
import { TaskModal } from '@/components/calendar/TaskModal';
import type { MJalaliDate, Task, CalendarEvent } from '@/types/calendar';
import { EventModal } from '@/components/calendar/EventModal';
import {
  JALALI_MONTHS,
  getTodayJalali,
  formatJalali,
  toGregorian,
  gregorianToISO,
  getGregorianForJalali,
  formatGregorian,
  getHijriForDate,
  formatHijri,
  isSameDay,
  toFaDigits,
} from '@/utils/jalaliDate';

export function CalendarPage() {
  const tasks = useCalendarStore((s) => s.tasks);
  const events = useCalendarStore((s) => s.events);
  const holidays = useCalendarStore((s) => s.holidays);
  const preferences = useCalendarStore((s) => s.preferences);
  const addTask = useCalendarStore((s) => s.addTask);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const updateTask = useCalendarStore((s) => s.updateTask);
  const toggleTask = useCalendarStore((s) => s.toggleTask);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const launchAiPrompt = useAppStore((s) => s.launchAiPrompt);

  const today = getTodayJalali();
  const [view, setView] = useState<MJalaliDate>({ year: today.year, month: today.month, day: 1 });
  const [selected, setSelected] = useState<MJalaliDate>(today);
  const [dayViewMode, setDayViewMode] = useState<'timeline' | 'list'>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const selectedISO = toISO(selected);
  const isSelectedToday = isSameDay(selected, today);

  const getHolidayForDate = useCallback(
    (d: MJalaliDate) => {
      const iso = gregorianToISO(toGregorian(d.year, d.month, d.day));
      return holidays.find((h) => h.gregorianDate === iso) ?? null;
    },
    [holidays],
  );

  const hasItems = useCallback(
    (iso: string) =>
      events.some((e) => e.date === iso) || getVisibleTasksForDate(tasks, iso).length > 0,
    [events, tasks],
  );

  const selectedHoliday = useMemo(() => getHolidayForDate(selected), [selected, getHolidayForDate]);
  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => e.date === selectedISO)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, selectedISO],
  );
  const dayTasks = useMemo(() => getVisibleTasksForDate(tasks, selectedISO), [tasks, selectedISO]);

  const daySchedule = useMemo(
    () =>
      getTodaySchedule(
        dayEvents,
        dayTasks,
        preferences?.workStart ?? '08:00',
        preferences?.workEnd ?? '20:00',
      ),
    [dayEvents, dayTasks, preferences],
  );

  const unscheduledTasks = useMemo(
    () => dayTasks.filter((t) => !t.dueTime),
    [dayTasks],
  );

  const selectedGregorian = useMemo(() => formatGregorian(getGregorianForJalali(selected)), [selected]);
  const selectedHijri = useMemo(() => {
    const g = getGregorianForJalali(selected);
    return formatHijri(getHijriForDate(g.gy, g.gm, g.gd));
  }, [selected]);

  const jumpToToday = () => {
    setSelected(today);
    setView({ year: today.year, month: today.month, day: 1 });
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">تقویم و زمان‌بندی</h2>
          <p className="text-xs text-slate-500 mt-0.5">مدیریت رویدادها، کارها و روزهای تعطیل</p>
        </div>

        <div className="flex items-center gap-2">
          {!isSelectedToday && (
            <button
              onClick={jumpToToday}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-primary-600" />
              امروز
            </button>
          )}
          <button
            onClick={() =>
              launchAiPrompt(`برنامه روز ${formatJalali(selected, 'long')} من چطوره؟`)
            }
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-primary-600 to-primary-800 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-primary-700/20 hover:brightness-105 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent-300" />
            تحلیل این روز با AI
          </button>
        </div>
      </div>

      {/* Desktop Split-View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Right Column (5 cols): Month Calendar */}
        <div className="lg:col-span-5 space-y-4">
          <MiniCalendar
            view={view}
            selected={selected}
            onSelect={(d) => {
              setSelected(d);
              setView({ year: d.year, month: d.month, day: 1 });
            }}
            onNavigate={(dir) => {
              setView((prev) => {
                let month = prev.month + dir;
                let year = prev.year;
                if (month < 1) {
                  month = 12;
                  year -= 1;
                } else if (month > 12) {
                  month = 1;
                  year += 1;
                }
                return { year, month, day: 1 };
              });
            }}
            hasItems={hasItems}
            isHoliday={(iso) => holidays.some((h) => h.gregorianDate === iso && h.isOfficialHoliday)}
          />

          {/* Legend & Quick Stats */}
          <div className="card-base rounded-2xl p-4 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-500" />
                دارای برنامه
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                تعطیل رسمی
              </span>
            </div>
            <span className="font-semibold text-slate-700">
              {toFaDigits(String(dayEvents.length + dayTasks.length))} مورد در این روز
            </span>
          </div>
        </div>

        {/* Left Column (7 cols): Selected Day Planner */}
        <div className="lg:col-span-7 space-y-4">
          {/* Selected day header */}
          <div className="card-premium rounded-3xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-md shadow-primary-700/25">
                  <span className="text-xl font-black leading-none">{toFaDigits(selected.day)}</span>
                  <span className="mt-1 text-[10px] font-medium text-primary-100">{JALALI_MONTHS[selected.month - 1]}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base sm:text-lg font-extrabold text-slate-900">
                      {formatJalali(selected, 'full')}
                    </p>
                    {isSelectedToday && (
                      <span className="rounded-full bg-primary-50 border border-primary-100 px-2.5 py-0.5 text-[10px] font-bold text-primary-700">
                        امروز
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400" dir="ltr" style={{ textAlign: 'right' }}>
                    {selectedGregorian} • {selectedHijri}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingTask(null); setModalOpen(true); }}
                  className="flex items-center gap-1.5 rounded-xl bg-primary-700 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-primary-700/20 hover:bg-primary-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  کار
                </button>
                <button
                  onClick={() => { setEditingEvent(null); setEventModalOpen(true); }}
                  className="flex items-center gap-1.5 rounded-xl bg-accent-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-accent-600/20 hover:bg-accent-700 transition-colors"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  رویداد
                </button>
              </div>
            </div>

            {selectedHoliday && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3.5 py-2.5 text-xs text-red-600">
                <PartyPopper className="h-4 w-4 shrink-0" />
                <span className="font-medium">
                  {selectedHoliday.title}
                  {selectedHoliday.isOfficialHoliday ? ' (تعطیل رسمی)' : ''}
                </span>
              </div>
            )}

            {/* View Toggle */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
                <button
                  onClick={() => setDayViewMode('list')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    dayViewMode === 'list'
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  دسته‌بندی
                </button>
                <button
                  onClick={() => setDayViewMode('timeline')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    dayViewMode === 'timeline'
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  تایم‌لاین ساعتی
                </button>
              </div>

              <span className="text-[11px] text-slate-400">
                {toFaDigits(String(dayEvents.length))} رویداد • {toFaDigits(String(dayTasks.length))} کار
              </span>
            </div>
          </div>

          {/* Day items */}
          <motion.div
            key={`${selectedISO}-${dayViewMode}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {dayEvents.length === 0 && dayTasks.length === 0 ? (
              <div className="card-base rounded-3xl p-10 text-center space-y-3">
                <CalendarIcon className="mx-auto h-10 w-10 text-slate-300" />
                <div>
                  <p className="text-sm font-semibold text-slate-600">برای این روز رویداد یا کاری ثبت نشده</p>
                  <p className="mt-1 text-xs text-slate-400">
                    از دکمه‌های بالا کار یا رویداد اضافه کن، یا از هوش مصنوعی بخواه برنامه‌اش را بچیند
                  </p>
                </div>
              </div>
            ) : dayViewMode === 'timeline' ? (
              <div className="card-base rounded-3xl p-5 space-y-4">
                {daySchedule.items.length > 0 ? (
                  <div className="relative space-y-3 pr-4 before:absolute before:right-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200/80">
                    {daySchedule.items.map((item) => (
                      <div key={item.id} className="relative flex items-start gap-3">
                        <span
                          className="absolute -right-[13px] top-4 h-3 w-3 rounded-full ring-4 ring-white"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="flex-1 rounded-2xl border border-slate-200/70 bg-white p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {toFaDigits(item.time)}
                              {item.endTime ? ` - ${toFaDigits(item.endTime)}` : ''}
                            </span>
                          </div>
                          <span className="mt-1 inline-block text-[10px] font-medium text-primary-600">
                            {item.type === 'event' ? 'رویداد زمان‌بندی‌شده' : 'کار زمان‌دار'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-400 py-3">
                    مورد زمان‌داری برای تایم‌لاین ثبت نشده است.
                  </p>
                )}

                {unscheduledTasks.length > 0 && (
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500">کارهای بدون ساعت مشخص</p>
                    {unscheduledTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={(t) => toggleTask(t.id)}
                        onDelete={deleteTask}
                        onEdit={(t) => { setEditingTask(t); setModalOpen(true); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {dayEvents.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <div className="h-2 w-2 rounded-full bg-cyan-500" />
                      <p className="text-xs font-bold text-slate-600">رویدادها</p>
                    </div>
                    {dayEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onDelete={deleteEvent}
                        onEdit={(e) => { setEditingEvent(e); setEventModalOpen(true); }}
                      />
                    ))}
                  </div>
                )}
                {dayTasks.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2 px-1">
                      <div className="h-2 w-2 rounded-full bg-primary-500" />
                      <p className="text-xs font-bold text-slate-600">کارها</p>
                    </div>
                    {dayTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={(t) => toggleTask(t.id)}
                        onDelete={deleteTask}
                        onEdit={(t) => { setEditingTask(t); setModalOpen(true); }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </div>

      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        onSave={(t) => {
          if (editingTask) updateTask(editingTask.id, t);
          else addTask(t);
        }}
        task={editingTask}
        defaultDate={selectedISO}
      />
      <EventModal
        open={eventModalOpen}
        onClose={() => { setEventModalOpen(false); setEditingEvent(null); }}
        onSave={(e) => {
          if (editingEvent) updateEvent(editingEvent.id, e);
          else addEvent(e);
        }}
        event={editingEvent}
        defaultDate={selectedISO}
      />
    </div>
  );
}
