import { useState } from 'react';
import {
  ArrowRight,
  Settings,
  X,
  Phone,
  Loader2,
  CheckCircle2,
  LogOut,
  User,
  Clock,
  Crown,
  Zap,
  Gift,
  Sparkles,
  Bell,
  Shield,
  Volume2,
  Vibrate,
} from 'lucide-react';
import {
  ALARM_SOUNDS,
  getSavedAlarmSound,
  setSavedAlarmSound,
  getAlarmVibrationEnabled,
  setAlarmVibrationEnabled,
  previewAlarmSound,
  requestNotificationPermissions,
  type AlarmSoundId,
} from '@/services/calendar/notifications';
import {
  isStickyStatusEnabled,
  setStickyStatusEnabled,
  syncAndroidStatusAndWidgets,
} from '@/services/calendar/androidStatus';
import { useCalendarStore } from '@/store/calendarStore';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { PLANS } from '@/data/plans';
import * as api from '@/lib/api';

const APP_VERSION_LABEL = '1.1';
const APP_BUILD_NUMBER = '16';

export function AccountPage() {
  const setPage = useAppStore((s) => s.setPage);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const signOut = useAuthStore((s) => s.signOut);
  const planType = usePlanStore((s) => s.planType);
  const expiresAt = usePlanStore((s) => s.expiresAt);
  const aiAssistantUsage = usePlanStore((s) => s.aiAssistantUsage);
  const templateUsage = usePlanStore((s) => s.templateUsage);
  const getAiAssistantLimit = usePlanStore((s) => s.getAiAssistantLimit);
  const getTemplateLimit = usePlanStore((s) => s.getTemplateLimit);
  const currentPlan = PLANS.find((p) => p.id === planType);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [error, setError] = useState('');
  const [alarmSound, setAlarmSound] = useState<AlarmSoundId>(() => getSavedAlarmSound());
  const [vibration, setVibration] = useState<boolean>(() => getAlarmVibrationEnabled());
  const [stickyStatus, setStickyStatus] = useState<boolean>(() => isStickyStatusEnabled());
  const [notifStatus, setNotifStatus] = useState<string>('');

  const aiLimit = getAiAssistantLimit();
  const templateLimit = getTemplateLimit();
  const aiRemaining = aiLimit - aiAssistantUsage;
  const templateRemaining = templateLimit - templateUsage;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updatedUser = await api.updateAccount(fullName.trim());
      if (updatedUser) setUser(updatedUser);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMessage('');
    if (password.length < 4) {
      setPasswordMessage('رمز عبور باید حداقل ۴ کاراکتر باشد.');
      return;
    }
    if (password !== passwordConfirmation) {
      setPasswordMessage('تکرار رمز عبور با رمز جدید یکسان نیست.');
      return;
    }
    setSavingPassword(true);
    try {
      await api.setPassword(password);
      setPassword('');
      setPasswordConfirmation('');
      setPasswordMessage('رمز عبور با موفقیت تغییر کرد.');
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'تغییر رمز عبور انجام نشد.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Back header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPage('home')}
          className="flex h-10 w-10 items-center justify-center rounded-xl card-base text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-bold text-slate-900">حساب کاربری</h2>
        </div>
      </div>

      {/* Subscription card */}
      <div className="card-premium rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${currentPlan?.gradient ?? 'from-slate-400 to-slate-600'} text-white shadow-lg`}>
              {planType === 'pro' ? <Crown className="h-6 w-6" /> : planType === 'basic' ? <Zap className="h-6 w-6" /> : <Gift className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-xs text-slate-500">طرح اشتراک</p>
              <p className="text-lg font-bold text-slate-900">طرح {currentPlan?.name ?? 'آزمایشی'}</p>
              {expiresAt ? (
                <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  انقضا: {new Date(expiresAt).toLocaleDateString('fa-IR')}
                </p>
              ) : planType === 'free' && (
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">بدون انقضا</p>
              )}
            </div>
          </div>
          {planType !== 'pro' && (
            <button
              onClick={() => setPage('pricing')}
              className="flex items-center gap-1.5 rounded-xl bg-primary-700 text-white px-4 py-2 text-sm font-semibold hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/25"
            >
              <Crown className="h-4 w-4" />
              ارتقای طرح
            </button>
          )}
        </div>

        {/* Usage stats */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-primary-50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary-600" />
              <p className="text-xs font-semibold text-primary-700">پیام دستیار</p>
            </div>
            <p className="text-sm font-bold text-slate-800">
              {aiRemaining.toLocaleString('fa-IR')} / {aiLimit.toLocaleString('fa-IR')}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">در روز</p>
          </div>
          <div className="rounded-xl bg-accent-50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="h-4 w-4 text-accent-600" />
              <p className="text-xs font-semibold text-accent-700">ثبت خودکار</p>
            </div>
            <p className="text-sm font-bold text-slate-800">
              {templateRemaining.toLocaleString('fa-IR')} / {templateLimit.toLocaleString('fa-IR')}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">در روز</p>
          </div>
        </div>
      </div>

      {/* Profile card */}
      <div className="card-base rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-700 to-primary-950 text-white text-xl font-bold shadow-lg">
            {(user?.full_name || user?.phone || 'ک').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{user?.full_name || 'کاربر'}</p>
            <p className="text-xs text-slate-400 truncate" dir="ltr">{user?.phone ?? ''}</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">شماره موبایل</label>
          <div className="relative">
            <Phone className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-500" />
            <input
              type="tel"
              value={user?.phone ?? ''}
              readOnly
              dir="ltr"
              className="w-full rounded-xl border border-primary-100 bg-white py-3 pl-4 pr-11 text-sm font-semibold text-slate-800 text-left outline-none"
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">شماره موبایل قابل ویرایش نیست.</p>
        </div>

        <form onSubmit={handleSave} className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">نام و نام خانوادگی</label>
          <div className="relative mb-3">
            <User className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="نام شما"
              dir="rtl"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-11 pl-4 text-sm text-slate-900 placeholder:text-slate-400 focus-ring"
            />
          </div>

          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <X className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {saved && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <p className="text-xs text-green-600">اطلاعات حساب با موفقیت به‌روزرسانی شد.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-700 text-white py-3 text-sm font-semibold hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/25 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'ذخیره تغییرات'}
          </button>
        </form>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary-500" />
            <h4 className="text-sm font-bold text-slate-800">تغییر رمز عبور</h4>
          </div>
          <div className="space-y-2.5">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="رمز عبور جدید"
              dir="ltr"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus-ring"
            />
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              placeholder="تکرار رمز عبور جدید"
              dir="ltr"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus-ring"
            />
            {passwordMessage && (
              <p className={`text-xs ${passwordMessage.includes('موفقیت') ? 'text-emerald-600' : 'text-red-500'}`}>
                {passwordMessage}
              </p>
            )}
            <button
              onClick={handlePasswordChange}
              disabled={savingPassword}
              className="w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-700/20 transition-colors hover:bg-primary-800 disabled:opacity-50"
            >
              {savingPassword ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'تغییر رمز عبور'}
            </button>
          </div>
        </div>
      </div>

      {/* Alarm & Notification settings */}
      <div className="card-base rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">تنظیمات آلارم و یادآوری</h3>
          </div>
          <button
            type="button"
            onClick={async () => {
              const ok = await requestNotificationPermissions();
              setNotifStatus(ok ? 'مجوز اعلان‌ها فعال است.' : 'مجوز اعلان‌ها داده نشد.');
            }}
            className="rounded-xl bg-primary-50 px-3 py-1.5 text-[11px] font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
          >
            بررسی مجوز اعلان
          </button>
        </div>

        {notifStatus && <p className="text-xs text-accent-700">{notifStatus}</p>}

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">صدای آلارم پیش‌فرض</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALARM_SOUNDS.map((s) => {
              const active = alarmSound === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setAlarmSound(s.id);
                    setSavedAlarmSound(s.id);
                    previewAlarmSound(s.id);
                  }}
                  className={`flex items-center justify-between rounded-xl border p-3 text-right transition-all ${
                    active
                      ? 'border-primary-500 bg-primary-50/70 text-primary-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold">{s.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                  </div>
                  <Volume2 className={`h-4 w-4 shrink-0 ${active ? 'text-primary-600' : 'text-slate-400'}`} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-surface/60 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Vibrate className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">لرزش گوشی هنگام آلارم</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !vibration;
              setVibration(next);
              setAlarmVibrationEnabled(next);
            }}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
              vibration ? 'bg-accent-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {vibration ? 'فعال' : 'غیرفعال'}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-surface/60 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary-500" />
            <div>
              <span className="block text-xs font-semibold text-slate-700">نمایش وضعیت روزانه در نوار اعلان</span>
              <span className="block text-[10px] text-slate-400">نمایش تاریخ و کارها حتی وقتی برنامه بسته است</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !stickyStatus;
              setStickyStatus(next);
              setStickyStatusEnabled(next);
              const st = useCalendarStore.getState();
              void syncAndroidStatusAndWidgets(
                st.tasks,
                st.events,
                st.preferences?.workStart ?? '08:00',
                st.preferences?.workEnd ?? '20:00',
              );
            }}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
              stickyStatus ? 'bg-primary-700 text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {stickyStatus ? 'فعال' : 'غیرفعال'}
          </button>
        </div>
      </div>

      {/* App version */}
      <div className="card-base rounded-2xl p-4 flex items-center justify-between">
        <p className="text-xs text-slate-500">نسخه برنامه</p>
        <p className="text-sm font-semibold text-slate-800" dir="ltr">
          {APP_VERSION_LABEL} ({APP_BUILD_NUMBER})
        </p>
      </div>

      {/* Sign out */}
      <button
        onClick={() => signOut()}
        className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-red-500 transition-colors py-2"
      >
        <LogOut className="h-4 w-4" />
        خروج از حساب
      </button>
    </div>
  );
}
