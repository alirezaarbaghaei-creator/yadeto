import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlarmClock, Clock, VolumeX, X } from 'lucide-react';
import {
  subscribeToAlarms,
  snoozeAlarm,
  stopAlarmLoop,
  type ActiveAlarm,
} from '@/services/calendar/notifications';
import { toFaDigits } from '@/utils/jalaliDate';

export function AlarmOverlay() {
  const [alarms, setAlarms] = useState<ActiveAlarm[]>([]);

  useEffect(() => {
    return subscribeToAlarms((alarm) => {
      setAlarms((prev) => [...prev, alarm]);
    });
  }, []);

  const dismiss = (id: string) => {
    setAlarms((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (next.length === 0) stopAlarmLoop();
      return next;
    });
  };

  const handleSnooze = (alarm: ActiveAlarm) => {
    snoozeAlarm(alarm, 10);
    dismiss(alarm.id);
  };

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return toFaDigits(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    );
  };

  return (
    <AnimatePresence>
      {alarms.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4"
        >
          <div className="w-full max-w-sm space-y-3">
            {alarms.map((alarm) => (
              <motion.div
                key={alarm.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 p-6 text-white shadow-2xl"
              >
                <button
                  onClick={() => dismiss(alarm.id)}
                  className="absolute left-4 top-4 rounded-xl bg-white/10 p-2 text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
                  aria-label="خاموش کردن آلارم"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-white shadow-xl shadow-red-500/35">
                    <span className="absolute inset-0 rounded-full bg-amber-400/40 animate-ping" />
                    <AlarmClock className="relative h-10 w-10" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-3xl font-extrabold tracking-wider text-accent-300">
                      {formatTime(alarm.triggeredAt)}
                    </p>
                    <h3 className="text-lg font-bold text-white">{alarm.title}</h3>
                    <p className="text-sm leading-6 text-slate-300">{alarm.body}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full pt-2">
                    <button
                      onClick={() => handleSnooze(alarm)}
                      className="flex items-center justify-center gap-1.5 rounded-2xl bg-white/12 border border-white/15 py-3 text-xs font-bold text-amber-200 hover:bg-white/20 transition-colors"
                    >
                      <Clock className="h-4 w-4" />
                      تعویق ۱۰ دقیقه
                    </button>
                    <button
                      onClick={() => dismiss(alarm.id)}
                      className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-l from-red-500 to-amber-500 py-3 text-xs font-bold text-white shadow-lg shadow-red-500/25 hover:brightness-110 transition-all"
                    >
                      <VolumeX className="h-4 w-4" />
                      خاموش کردن
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
