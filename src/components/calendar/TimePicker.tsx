import { useState, useRef, useCallback } from 'react';
import { Clock, Check, X } from 'lucide-react';
import { toFaDigits } from '@/utils/jalaliDate';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const DIAL_SIZE = 240;
const CENTER = DIAL_SIZE / 2;
const RADIUS = 88;

const HOUR_NUMS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_NUMS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');

  const [rawH, rawM] = (value || '10:00').split(':').map(Number);
  const initialH24 = Number.isFinite(rawH) && rawH >= 0 && rawH < 24 ? rawH : 10;
  const initialM = Number.isFinite(rawM) && rawM >= 0 && rawM < 60 ? rawM : 0;

  const [isPm, setIsPm] = useState(initialH24 >= 12);
  const [hour12, setHour12] = useState(() => {
    const h = initialH24 % 12;
    return h === 0 ? 12 : h;
  });
  const [minute, setMinute] = useState(initialM);
  const dialRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const openPicker = () => {
    const [h, m] = (value || '10:00').split(':').map(Number);
    const h24 = Number.isFinite(h) && h >= 0 && h < 24 ? h : 10;
    const min = Number.isFinite(m) && m >= 0 && m < 60 ? m : 0;
    setIsPm(h24 >= 12);
    setHour12(h24 % 12 === 0 ? 12 : h24 % 12);
    setMinute(min);
    setMode('hour');
    setOpen(true);
  };

  const to24Hour = (h12: number, pm: boolean) => {
    if (pm) return h12 === 12 ? 12 : h12 + 12;
    return h12 === 12 ? 0 : h12;
  };

  const handleConfirm = () => {
    const h24 = to24Hour(hour12, isPm);
    const formatted = `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onChange(formatted);
    setOpen(false);
  };

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = dialRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      // Angle in degrees where 12 o'clock (top) is 0°, clockwise
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;

      if (mode === 'hour') {
        let h = Math.round(deg / 30) % 12;
        if (h === 0) h = 12;
        setHour12(h);
      } else {
        let m = Math.round(deg / 6) % 60;
        setMinute(m);
      }
    },
    [mode],
  );

  const activeAngleDeg = mode === 'hour' ? (hour12 % 12) * 30 : minute * 6;
  const activeRad = ((activeAngleDeg - 90) * Math.PI) / 180;
  const handX = CENTER + RADIUS * Math.cos(activeRad);
  const handY = CENTER + RADIUS * Math.sin(activeRad);

  const displayH24 = String(initialH24).padStart(2, '0');
  const displayMin = String(initialM).padStart(2, '0');
  const displayPeriod = initialH24 >= 12 ? 'ب.ظ' : 'ق.ظ';

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[11px] font-medium text-slate-500">{label}</label>}
      <button
        type="button"
        onClick={openPicker}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-primary-50/40 hover:border-primary-300 px-3 py-2.5 transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <Clock className="h-4 w-4" />
          </span>
          <span className="text-sm font-extrabold text-slate-800" dir="ltr">
            {toFaDigits(displayH24)}:{toFaDigits(displayMin)}
          </span>
        </div>
        <span className="rounded-md bg-white border border-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-500">
          {displayPeriod}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          dir="rtl"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl space-y-4 border border-slate-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary-600" />
                انتخاب ساعت و دقیقه
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Digital Display + AM/PM */}
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3 border border-slate-200/70" dir="ltr">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode('hour')}
                  className={`rounded-xl px-3.5 py-2 text-2xl font-black transition-all ${
                    mode === 'hour'
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {toFaDigits(String(hour12).padStart(2, '0'))}
                </button>
                <span className="text-2xl font-black text-slate-400">:</span>
                <button
                  type="button"
                  onClick={() => setMode('minute')}
                  className={`rounded-xl px-3.5 py-2 text-2xl font-black transition-all ${
                    mode === 'minute'
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
                      : 'bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {toFaDigits(String(minute).padStart(2, '0'))}
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setIsPm(false)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    !isPm ? 'bg-accent-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
                  ق.ظ
                </button>
                <button
                  type="button"
                  onClick={() => setIsPm(true)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    isPm ? 'bg-accent-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200'
                  }`}
                >
                  ب.ظ
                </button>
              </div>
            </div>

            {/* Interactive Analog Clock Dial */}
            <div className="flex justify-center">
              <div
                ref={dialRef}
                onPointerDown={(e) => {
                  draggingRef.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  updateFromPointer(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (!draggingRef.current) return;
                  updateFromPointer(e.clientX, e.clientY);
                }}
                onPointerUp={() => {
                  if (!draggingRef.current) return;
                  draggingRef.current = false;
                  if (mode === 'hour') {
                    setMode('minute');
                  }
                }}
                style={{ width: DIAL_SIZE, height: DIAL_SIZE, touchAction: 'none' }}
                className="relative select-none rounded-full bg-gradient-to-b from-slate-50 to-slate-100 border-2 border-slate-200/80 shadow-inner cursor-pointer"
              >
                {/* Clock Hand SVG */}
                <svg width={DIAL_SIZE} height={DIAL_SIZE} className="absolute inset-0 pointer-events-none">
                  <defs>
                    <linearGradient id="clockHandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                  {/* Subtle 12 tick marks */}
                  {Array.from({ length: 12 }, (_, idx) => {
                    const rad = ((idx * 30 - 90) * Math.PI) / 180;
                    const x1 = CENTER + 108 * Math.cos(rad);
                    const y1 = CENTER + 108 * Math.sin(rad);
                    const x2 = CENTER + 114 * Math.cos(rad);
                    const y2 = CENTER + 114 * Math.sin(rad);
                    return (
                      <line
                        key={idx}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#cbd5e1"
                        strokeWidth={idx % 3 === 0 ? 2 : 1}
                        strokeLinecap="round"
                      />
                    );
                  })}
                  {/* Hand Line */}
                  <line
                    x1={CENTER}
                    y1={CENTER}
                    x2={handX}
                    y2={handY}
                    stroke="url(#clockHandGrad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Center Dot */}
                  <circle cx={CENTER} cy={CENTER} r="5.5" fill="#4f46e5" />
                  {/* Active Selector Circle */}
                  <circle cx={handX} cy={handY} r="18" fill="#4f46e5" />
                </svg>

                {/* Dial Numbers */}
                {(mode === 'hour' ? HOUR_NUMS : MINUTE_NUMS).map((num, i) => {
                  const deg = i * 30;
                  const rad = ((deg - 90) * Math.PI) / 180;
                  const x = CENTER + RADIUS * Math.cos(rad);
                  const y = CENTER + RADIUS * Math.sin(rad);
                  const isSelected = mode === 'hour' ? hour12 === num : minute === num;

                  return (
                    <div
                      key={num}
                      style={{
                        left: x - 18,
                        top: y - 18,
                        width: 36,
                        height: 36,
                      }}
                      className={`pointer-events-none absolute flex items-center justify-center rounded-full text-sm font-extrabold transition-colors ${
                        isSelected ? 'text-white' : 'text-slate-700'
                      }`}
                    >
                      {toFaDigits(mode === 'minute' ? String(num).padStart(2, '0') : String(num))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Minute Shortcuts */}
            <div className="flex items-center gap-1.5" dir="ltr">
              {[0, 15, 30, 45].map((qm) => (
                <button
                  key={qm}
                  type="button"
                  onClick={() => {
                    setMinute(qm);
                    setMode('minute');
                  }}
                  className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-colors ${
                    minute === qm
                      ? 'bg-primary-100 text-primary-700 border border-primary-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  :{toFaDigits(String(qm).padStart(2, '0'))}
                </button>
              ))}
            </div>

            {/* Confirm Button */}
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 py-3 text-sm font-bold text-white shadow-lg shadow-primary-700/25 hover:brightness-105 active:scale-95 transition-all"
            >
              <Check className="h-4 w-4" />
              تایید ساعت ({toFaDigits(String(to24Hour(hour12, isPm)).padStart(2, '0'))}:
              {toFaDigits(String(minute).padStart(2, '0'))})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
