import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Clock, X } from 'lucide-react';
import {
  subscribeToAlarms,
  snoozeAlarm,
  type ActiveAlarm,
} from '@/services/calendar/notifications';

export function AlarmOverlay() {
  const [alarms, setAlarms] = useState<ActiveAlarm[]>([]);

  useEffect(() => {
    return subscribeToAlarms((alarm) => {
      setAlarms((prev) => [...prev, alarm]);
    });
  }, []);

  const dismiss = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSnooze = (alarm: ActiveAlarm) => {
    snoozeAlarm(alarm, 10);
    dismiss(alarm.id);
  };

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-96 z-50 space-y-2 pointer-events-none">
      <AnimatePresence>
        {alarms.map((alarm) => (
          <motion.div
            key={alarm.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            className="pointer-events-auto rounded-3xl border border-primary-200 bg-white/95 backdrop-blur-xl p-4 shadow-2xl shadow-primary-900/20"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-red-500 text-white shadow-lg shadow-amber-500/30 animate-pulse">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1 text-right">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-slate-900">{alarm.title}</p>
                  <button
                    onClick={() => dismiss(alarm.id)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="بستن آلارم"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs leading-5 text-slate-600">{alarm.body}</p>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => handleSnooze(alarm)}
                    className="flex items-center gap-1 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    <Clock className="h-3 w-3" />
                    تعویق ۱۰ دقیقه
                  </button>
                  <button
                    onClick={() => dismiss(alarm.id)}
                    className="rounded-xl bg-primary-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary-800 transition-colors"
                  >
                    متوجه شدم
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
