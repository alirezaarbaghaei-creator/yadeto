import { toFaDigits } from '@/utils/jalaliDate';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const QUICK_MINUTES = ['00', '15', '30', '45'];

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [rawH, rawM] = (value || '10:00').split(':');
  const hour = HOURS.includes(rawH) ? rawH : '10';
  const minute = MINUTES.includes(rawM) ? rawM : '00';

  const setHour = (h: string) => onChange(`${h}:${minute}`);
  const setMinute = (m: string) => onChange(`${hour}:${m}`);

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[11px] font-medium text-slate-500">{label}</label>}
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5" dir="ltr">
        <select
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          aria-label="ساعت"
          className="flex-1 bg-transparent py-1 text-center text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {toFaDigits(h)}
            </option>
          ))}
        </select>
        <span className="text-sm font-bold text-slate-400">:</span>
        <select
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          aria-label="دقیقه"
          className="flex-1 bg-transparent py-1 text-center text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {toFaDigits(m)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1" dir="ltr">
        {QUICK_MINUTES.map((qm) => (
          <button
            key={qm}
            type="button"
            onClick={() => setMinute(qm)}
            className={`flex-1 rounded-lg py-0.5 text-[10px] font-semibold transition-colors ${
              minute === qm
                ? 'bg-primary-100 text-primary-700'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            :{toFaDigits(qm)}
          </button>
        ))}
      </div>
    </div>
  );
}
