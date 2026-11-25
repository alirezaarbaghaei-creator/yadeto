import { ChevronRight, ChevronLeft } from 'lucide-react';
import type { MJalaliDate } from '@/types/calendar';
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  getMonthMatrix,
  getTodayJalali,
  isFriday,
  isSameDay,
  toFaDigits,
  toGregorian,
  gregorianToISO,
} from '@/utils/jalaliDate';

interface MiniCalendarProps {
  view: MJalaliDate;
  selected: MJalaliDate;
  onSelect: (d: MJalaliDate) => void;
  onNavigate: (dir: -1 | 1) => void;
  /** Optional dot marker (tasks/events) keyed by Gregorian ISO date */
  hasItems?: (iso: string) => boolean;
  /** Highlight official holidays */
  isHoliday?: (iso: string) => boolean;
}

export function toISO(d: MJalaliDate): string {
  return gregorianToISO(toGregorian(d.year, d.month, d.day));
}

export function MiniCalendar({ view, selected, onSelect, onNavigate, hasItems, isHoliday }: MiniCalendarProps) {
  const matrix = getMonthMatrix(view);
  const today = getTodayJalali();

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-card">
      {/* Month header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => onNavigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/70 bg-slate-50/70 text-slate-600 transition-all hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 active:scale-95"
          aria-label="ماه قبل"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-l from-primary-50/80 to-accent-50/60 border border-primary-100/80 px-4 py-1.5">
          <span className="text-base font-black text-slate-800">
            {JALALI_MONTHS[view.month - 1]}
          </span>
          <span className="text-sm font-bold text-primary-600">
            {toFaDigits(view.year)}
          </span>
        </div>

        <button
          onClick={() => onNavigate(1)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/70 bg-slate-50/70 text-slate-600 transition-all hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 active:scale-95"
          aria-label="ماه بعد"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {JALALI_WEEKDAYS_SHORT.map((w, i) => (
          <div
            key={w}
            className={`py-1.5 text-center text-[11px] font-bold rounded-lg ${
              i === 6 ? 'text-rose-500 bg-rose-50/60' : 'text-slate-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="space-y-1.5">
        {matrix.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((day, di) => {
              if (!day) return <div key={`e-${di}`} className="h-11" />;
              const iso = toISO(day);
              const isSelected = isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              const holiday = isHoliday?.(iso);
              const marker = hasItems?.(iso);
              const friday = isFriday(day);
              return (
                <button
                  key={iso}
                  onClick={() => onSelect(day)}
                  className={`relative flex h-11 flex-col items-center justify-center rounded-2xl text-sm font-bold transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-lg shadow-primary-700/30 scale-[1.03]'
                      : isToday
                        ? 'bg-primary-50 text-primary-700 ring-2 ring-primary-400/80'
                        : holiday
                          ? 'bg-rose-50/90 text-rose-600 border border-rose-100 hover:bg-rose-100'
                          : friday
                            ? 'text-rose-500 hover:bg-rose-50/50'
                            : 'text-slate-700 hover:bg-slate-100/80'
                  }`}
                >
                  <span className="leading-none">{toFaDigits(day.day)}</span>
                  {marker && (
                    <span
                      className={`mt-1 h-1.5 w-1.5 rounded-full ${
                        isSelected ? 'bg-accent-300' : holiday ? 'bg-rose-500' : 'bg-accent-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
