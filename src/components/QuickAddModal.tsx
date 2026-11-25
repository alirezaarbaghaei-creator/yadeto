import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListTodo, CalendarPlus, StickyNote, Mic, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useCalendarStore } from '@/store/calendarStore';
import { TaskModal } from '@/components/calendar/TaskModal';
import { EventModal } from '@/components/calendar/EventModal';
import { getTodayISO } from '@/utils/jalaliDate';
import type { Task, CalendarEvent } from '@/types/calendar';

export function QuickAddModal() {
  const quickAddType = useAppStore((s) => s.quickAddType);
  const closeQuickAdd = useAppStore((s) => s.closeQuickAdd);
  const setPage = useAppStore((s) => s.setPage);
  const launchAiVoice = useAppStore((s) => s.launchAiVoice);
  const addTask = useCalendarStore((s) => s.addTask);
  const addEvent = useCalendarStore((s) => s.addEvent);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  const todayISO = getTodayISO();

  useEffect(() => {
    if (quickAddType === 'task') {
      setTaskModalOpen(true);
    } else if (quickAddType === 'event') {
      setEventModalOpen(true);
    } else if (quickAddType === 'picker') {
      setPickerOpen(true);
    }
  }, [quickAddType]);

  const handleCloseAll = () => {
    setTaskModalOpen(false);
    setEventModalOpen(false);
    setPickerOpen(false);
    closeQuickAdd();
  };

  return (
    <>
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm"
            onClick={handleCloseAll}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm rounded-t-3xl bg-white p-6 pb-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-slate-900">افزودن سریع</h3>
                <button
                  onClick={handleCloseAll}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setPickerOpen(false);
                    setTaskModalOpen(true);
                  }}
                  className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-slate-100 p-4 transition-all hover:border-primary-300 hover:bg-primary-50/30 hover:shadow-lg"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                    <ListTodo className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-800">کار جدید</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">با اولویت و یادآوری</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setPickerOpen(false);
                    setEventModalOpen(true);
                  }}
                  className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-slate-100 p-4 transition-all hover:border-accent-300 hover:bg-accent-50/30 hover:shadow-lg"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-700">
                    <CalendarPlus className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-800">رویداد جدید</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">با ساعت و مکان</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleCloseAll();
                    setPage('notes');
                  }}
                  className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-slate-100 p-4 transition-all hover:border-amber-300 hover:bg-amber-50/30 hover:shadow-lg"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <StickyNote className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-800">یادداشت جدید</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">ذخیره متن و ایده</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleCloseAll();
                    launchAiVoice();
                  }}
                  className="flex flex-col items-center gap-2.5 rounded-2xl border-2 border-primary-100 bg-gradient-to-b from-primary-50/50 to-accent-50/30 p-4 transition-all hover:border-primary-300 hover:shadow-lg"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 text-white shadow-md shadow-primary-600/25">
                    <Mic className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-primary-800">مکالمه صوتی</p>
                    <p className="text-[10px] text-primary-600 mt-0.5">صحبت مستقیم با یادتو</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TaskModal
        open={taskModalOpen}
        onClose={handleCloseAll}
        onSave={(t: Partial<Task>) => {
          addTask(t);
          handleCloseAll();
        }}
        defaultDate={todayISO}
      />

      <EventModal
        open={eventModalOpen}
        onClose={handleCloseAll}
        onSave={(e: Partial<CalendarEvent>) => {
          addEvent(e);
          handleCloseAll();
        }}
        defaultDate={todayISO}
      />
    </>
  );
}
