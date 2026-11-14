import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar as CalendarIcon, Clock, MapPin, Palette, CalendarPlus } from 'lucide-react';
import type { CalendarEvent, TaskCategory, MJalaliDate } from '@/types/calendar';
import { MiniCalendar, toISO } from './MiniCalendar';
import { getTodayJalali, isoDateToJalali, formatJalali } from '@/utils/jalaliDate';

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => void;
  event?: CalendarEvent | null;
  defaultDate?: string;
}

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'work', label: 'کاری' },
  { value: 'personal', label: 'شخصی' },
  { value: 'health', label: 'سلامتی' },
  { value: 'finance', label: 'مالی' },
  { value: 'education', label: 'تحصیلی' },
  { value: 'social', label: 'اجتماعی' },
  { value: 'other', label: 'سایر' },
];

const COLORS: { value: string; label: string }[] = [
  { value: '#4f46e5', label: 'بنفش' },
  { value: '#0ea5e9', label: 'آبی' },
  { value: '#10b981', label: 'سبز' },
  { value: '#f59e0b', label: 'کهربایی' },
  { value: '#ef4444', label: 'قرمز' },
  { value: '#8b5cf6', label: 'یاسی' },
];

export function EventModal({ open, onClose, onSave, event, defaultDate }: EventModalProps) {
  const [title, setTitle] = useState('');
  const [selectedJalali, setSelectedJalali] = useState<MJalaliDate>(getTodayJalali());
  const [startTime, setStartTime] = useState('10:00');
  const [hasEndTime, setHasEndTime] = useState(false);
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<TaskCategory>('work');
  const [color, setColor] = useState('#4f46e5');
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(event?.title || '');
    const dateStr = event?.date || defaultDate || '';
    setSelectedJalali(dateStr ? isoDateToJalali(dateStr) : getTodayJalali());
    setStartTime(event?.startTime || '10:00');
    if (event?.endTime) {
      setEndTime(event.endTime);
      setHasEndTime(true);
    } else {
      setEndTime('11:00');
      setHasEndTime(false);
    }
    setLocation(event?.location || '');
    setCategory(event?.category || 'work');
    setColor(event?.color || '#4f46e5');
    setShowCalendar(false);
  }, [open, event, defaultDate]);

  if (!open) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      date: toISO(selectedJalali),
      startTime,
      endTime: hasEndTime ? endTime : undefined,
      location: location.trim() || undefined,
      category,
      color,
      reminder: 15,
    });
    onClose();
  };

  const chip = (active: boolean, activeCls: string) =>
    `rounded-full border px-3 py-1.5 text-xs transition-all ${
      active ? activeCls : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-glass-lg sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {event ? 'ویرایش رویداد' : 'رویداد جدید'}
          </h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">عنوان رویداد</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً جلسه پروژه"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus-ring"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">تاریخ</label>
            <button
              onClick={() => setShowCalendar((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-indigo-300"
            >
              <span className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-indigo-500" />
                {formatJalali(selectedJalali, 'long')}
              </span>
              <span className="text-xs text-indigo-500">تغییر</span>
            </button>
            {showCalendar && (
              <div className="mt-2">
                <MiniCalendar
                  view={{ year: selectedJalali.year, month: selectedJalali.month, day: 1 }}
                  selected={selectedJalali}
                  onSelect={(d) => {
                    setSelectedJalali(d);
                    setShowCalendar(false);
                  }}
                  onNavigate={(dir) => {
                    setSelectedJalali((prev) => {
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
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">ساعت شروع</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <Clock className="h-4 w-4 text-indigo-500" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-700 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs text-slate-500">ساعت پایان</label>
                <button
                  onClick={() => setHasEndTime((v) => !v)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition-all ${
                    hasEndTime
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                      : 'border-slate-200 text-slate-400'
                  }`}
                >
                  {hasEndTime ? 'فعال' : 'بدون'}
                </button>
              </div>
              {hasEndTime ? (
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:outline-none"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-2.5 text-center text-xs text-slate-300">
                  —
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">مکان (اختیاری)</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <MapPin className="h-4 w-4 text-indigo-500" />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثلاً اتاق جلسات"
                className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">دسته‌بندی</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={chip(category === c.value, 'border-indigo-400 bg-indigo-50 text-indigo-600')}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-slate-500">
              <Palette className="h-3.5 w-3.5" />
              رنگ رویداد
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  aria-label={c.label}
                  className={`h-8 w-8 rounded-full transition-transform ${
                    color === c.value ? 'scale-110 ring-2 ring-slate-400 ring-offset-2' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <CalendarPlus className="h-4 w-4" />
          ذخیره
        </button>
      </motion.div>
    </div>
  );
}
