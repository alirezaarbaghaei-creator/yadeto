import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, Plus, PartyPopper } from 'lucide-react';
import { useCalendarStore } from '@/store/calendarStore';
import { MiniCalendar, toISO } from '@/components/calendar/MiniCalendar';
import { getVisibleTasksForDate } from '@/services/calendar/schedulingEngine';
import { TaskCard } from '@/components/calendar/TaskCard';
import { EventCard } from '@/components/calendar/EventCard';
import { TaskModal } from '@/components/calendar/TaskModal';
import type { MJalaliDate, Task, CalendarEvent } from '@/types/calendar';
import { EventModal } from '@/components/calendar/EventModal';
import {
  getTodayJalali,
  formatJalali,
  toGregorian,
  gregorianToISO,
  getGregorianForJalali,
  formatGregorian,
  getHijriForDate,
  formatHijri,
} from '@/utils/jalaliDate';

export function CalendarPage() {
  const tasks = useCalendarStore((s) => s.tasks);
  const events = useCalendarStore((s) => s.events);
  const holidays = useCalendarStore((s) => s.holidays);
  const addTask = useCalendarStore((s) => s.addTask);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const updateTask = useCalendarStore((s) => s.updateTask);
  const toggleTask = useCalendarStore((s) => s.toggleTask);
  const deleteTask = useCalendarStore((s) => s.deleteTask);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const updateEvent = useCalendarStore((s) => s.updateEvent);

  const today = getTodayJalali();
  const [view, setView] = useState<MJalaliDate>({ year: today.year, month: today.month, day: 1 });
  const [selected, setSelected] = useState<MJalaliDate>(today);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const selectedISO = toISO(selected);

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
  const dayEvents = useMemo(() => events.filter((e) => e.date === selectedISO), [events, selectedISO]);
  const dayTasks = useMemo(() => getVisibleTasksForDate(tasks, selectedISO), [tasks, selectedISO]);

  const selectedGregorian = useMemo(() => formatGregorian(getGregorianForJalali(selected)), [selected]);
  const selectedHijri = useMemo(() => {
    const g = getGregorianForJalali(selected);
    return formatHijri(getHijriForDate(g.gy, g.gm, g.gd));
  }, [selected]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-800">تقویم</h2>

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

      {/* Selected day header */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-slate-700">{formatJalali(selected, 'long')}</p>
            <p className="text-[11px] text-slate-400" dir="ltr" style={{ textAlign: 'right' }}>
              {selectedGregorian} • {selectedHijri}
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-500/30 hover:bg-indigo-700"
            aria-label="افزودن کار در این روز"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {selectedHoliday && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
            <PartyPopper className="h-4 w-4 shrink-0" />
            <span>
              {selectedHoliday.title}
              {selectedHoliday.isOfficialHoliday ? ' (تعطیل رسمی)' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Day items */}
      <motion.div
        key={selectedISO}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        {dayEvents.length === 0 && dayTasks.length === 0 ? (
          <div className="rounded-2xl bg-white/60 p-6 text-center">
            <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">برای این روز رویداد یا کاری ثبت نشده</p>
          </div>
        ) : (
          <>
            {dayEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onDelete={deleteEvent}
                onEdit={(e) => { setEditingEvent(e); setEventModalOpen(true); }}
              />
            ))}
            {dayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={(t) => toggleTask(t.id)}
                onDelete={deleteTask}
                onEdit={(t) => { setEditingTask(t); setModalOpen(true); }}
              />
            ))}
          </>
        )}
      </motion.div>

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
