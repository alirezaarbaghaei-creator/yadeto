import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListTodo, CalendarPlus, StickyNote, Mic, Sparkles, X } from 'lucide-react';
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

              {/* Featured AI Voice Assistant CTA */}
              <button
                onClick={() => {
                  handleCloseAll();
                  launchAiVoice();
                }}
                className="w-full mb-3.5 relative overflow-hidden flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-l from-primary-600 via-primary-700 to-accent-600 p-4 text-white shadow-xl shadow-primary-700/30 transition-all hover:scale-[1.01] active:scale-[0.98]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-2 ring-white/30">
                    <span className="absolute inset-0 rounded-2xl bg-white/25 animate-ping opacity-60" />
                    <Mic className="relative h-6 w-6 text-white" />
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-black text-white">مکالمه صوتی با دستیار</p>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-bold text-amber-200 border border-amber-300/30">
                        <Sparkles className="h-2.5 w-2.5" />
                        سریع
                      </span>
                    </div>
                    <p className="text-[11px] text-primary-100 mt-0.5">
                      صحبت کن تا کار، رویداد یا یادداشتت فوری ثبت بشه
                    </p>
                  </div>
                </div>
              </button>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => {
                    setPickerOpen(false);
                    setTaskModalOpen(true);
                  }}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 transition-all hover:border-primary-300 hover:bg-primary-50/40 active:scale-95"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <ListTodo className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">کار جدید</p>
                </button>

                <button
                  onClick={() => {
                    setPickerOpen(false);
                    setEventModalOpen(true);
                  }}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 transition-all hover:border-accent-300 hover:bg-accent-50/40 active:scale-95"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                    <CalendarPlus className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">رویداد جدید</p>
                </button>

                <button
                  onClick={() => {
                    handleCloseAll();
                    setPage('notes');
                  }}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 transition-all hover:border-amber-300 hover:bg-amber-50/40 active:scale-95"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <StickyNote className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">یادداشت</p>
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
