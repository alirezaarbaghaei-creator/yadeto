import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react';
import type { UserPreferences } from '@/types/calendar';

/**
 * First-run assistant questionnaire — a multi-step interview that teaches the
 * assistant the user's role, schedule and lifestyle so planning is personal
 * from day one. Work hours are required (24h format, simple RTL select fields).
 * Result is stored in preferences.onboarding (part of the calendar store).
 */

export interface AssistantOnboardingResult {
  role: string;
  jobTitle: string;
  wakeTime: string;
  sleepTime: string;
  preferences: Partial<UserPreferences>;
}

const ROLE_OPTIONS = [
  { value: 'employee', label: 'کارمند', hint: 'ساعات کاری منظم دارم' },
  { value: 'student', label: 'دانش‌آموز / دانشجو', hint: 'کلاس و درس دارم' },
  { value: 'teacher', label: 'معلم / استاد', hint: 'تدریس و امتحان' },
  { value: 'freelancer', label: 'فریلنسر / آزاد', hint: 'ساعاتم منعطف است' },
  { value: 'manager', label: 'مدیر / صاحب کسب‌وکار', hint: 'جلسه و تصمیم زیاد دارم' },
  { value: 'athlete', label: 'ورزشکار', hint: 'تمرین برنامه‌ای دارم' },
  { value: 'parent', label: 'خانواده و فرزند', hint: 'مسئولیت خانه و بچه‌ها' },
  { value: 'other', label: 'سایر', hint: 'خودت می‌گویم' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

interface Props {
  onComplete: (result: AssistantOnboardingResult) => void;
  onSkip?: () => void;
}

export function AssistantOnboarding({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [workStart, setWorkStart] = useState('08:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');

  const totalSteps = 4;

  useEffect(() => {
    if (role === 'student') {
      if (workStart === '08:00' && workEnd === '17:00') {
        setWorkStart('07:30'); setWorkEnd('14:00');
      }
    } else if (role === 'employee' || role === 'teacher') {
      setWorkStart('08:00'); setWorkEnd('17:00');
    } else if (role === 'freelancer') {
      setWorkStart('10:00'); setWorkEnd('18:00');
    }
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = step === 0 ? role !== '' : step === 1 ? jobTitle.trim().length > 0 : true;

  const finish = () => {
    const isStudent = role === 'student' || role === 'teacher';
    onComplete({
      role,
      jobTitle: jobTitle.trim(),
      wakeTime,
      sleepTime,
      preferences: {
        workStart,
        workEnd,
        workDays: isStudent ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4],
        defaultReminder: 15,
        notificationsEnabled: true,
      },
    });
  };

  const selectCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus-ring appearance-none cursor-pointer';
  const labelCls = 'mb-1.5 block text-xs font-medium text-slate-600';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">آشنایی با دستیار</h3>
            <p className="text-[11px] text-slate-400">مرحله {step + 1} از {totalSteps.toLocaleString('fa-IR')}</p>
          </div>
        </div>

        {/* progress */}
        <div className="mb-5 flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-indigo-500' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div>
            <p className="mb-4 text-sm leading-7 text-slate-600">
              چند سؤال کوتاه می‌پرسم تا برنامه‌ریزیم دقیقاً متناسب با زندگی «تو» باشد.
              نقش اصلی تو در زندگی چیه؟
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`rounded-xl border px-3 py-2.5 text-right transition-all ${
                    role === r.value
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                  }`}
                >
                  <b className="block text-xs">{r.label}</b>
                  <span className="text-[10px] text-slate-400">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-4 text-sm leading-7 text-slate-600">
              دقیق‌تر بگو: شغلت یا رشته تحصیلیت چیه؟ (مثلاً «کارمند بانک»، «پایه نهم»، «دانشجوی نرم‌افزار»)
            </p>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="مثلاً کارمند بانک..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus-ring"
              autoFocus
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-4 text-sm leading-7 text-slate-600">
              ساعات «کار یا درس» تو چه زمانی است؟ (الزامی — برنامه‌هات داخل این بازه چیده می‌شوند)
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>شروع کار / مدرسه</label>
                <select value={workStart} onChange={(e) => setWorkStart(e.target.value)} className={selectCls} dir="rtl">
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>پایان کار / مدرسه</label>
                <select value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className={selectCls} dir="rtl">
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="mb-4 text-sm leading-7 text-slate-600">
              و معمولاً چه ساعتی بیدار و خواب می‌شوی؟ (یادآوری‌ها را بیرون از ساعت خواب نمی‌گذارم)
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>ساعت بیدار شدن</label>
                <select value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className={selectCls} dir="rtl">
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>ساعت خواب</label>
                <select value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} className={selectCls} dir="rtl">
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ArrowRight className="h-4 w-4" />
              قبلی
            </button>
          )}
          {step === 0 && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-xl px-3 py-2.5 text-xs text-slate-400 hover:text-slate-600"
            >
              بعداً
            </button>
          )}
          <button
            type="button"
            disabled={!canNext}
            onClick={() => (step === totalSteps - 1 ? finish() : setStep((s) => s + 1))}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-700 disabled:opacity-40"
          >
            {step === totalSteps - 1 ? (
              <>
                <Check className="h-4 w-4" />
                شروع کنیم
              </>
            ) : (
              <>
                بعدی
                <ArrowLeft className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
