import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  CalendarDays,
  ListTodo,
  MessageCircle,
  User,
  LogOut,
  Settings,
  Shield,
  X,
  Phone,
  CheckCircle2,
  Loader2,
  Sparkles,
  Plus,
  StickyNote,
  AudioLines,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import * as api from '@/lib/api';
import { CreditBadge } from '@/components/CreditBadge';
import type { PageId } from '@/types';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof Home;
}

const baseNavItems: NavItem[] = [
  { id: 'home', label: 'خانه', icon: Home },
  { id: 'calendar', label: 'تقویم', icon: CalendarDays },
  { id: 'tasks', label: 'کارها', icon: ListTodo },
  { id: 'notes', label: 'یادداشت', icon: StickyNote },
  { id: 'assistant', label: 'دستیار', icon: MessageCircle },
];

const accountNavItem: NavItem = { id: 'account', label: 'حساب کاربری', icon: Settings };
const adminNavItem: NavItem = { id: 'admin', label: 'پنل مدیریت', icon: Shield };

function useNavItems(): NavItem[] {
  const user = useAuthStore((s) => s.user);
  if (user?.is_admin) return [...baseNavItems, adminNavItem, accountNavItem];
  return [...baseNavItems, accountNavItem];
}

function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';

  return (
    <img
      src="/logo.png"
      alt="Yadeto"
      className={`${dims} shrink-0 rounded-2xl object-cover shadow-md shadow-primary-900/15 border border-primary-100/80 bg-white`}
    />
  );
}

export function AccountModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const signOut = useAuthStore((s) => s.signOut);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [error, setError] = useState('');

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
      const msg = err instanceof Error ? err.message : 'خطای ناشناخته';
      setError(msg);
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 20 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-bold text-slate-900">حساب کاربری</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
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

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">نام و نام خانوادگی</label>
            <div className="relative">
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
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <X className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <p className="text-xs text-green-600">اطلاعات حساب با موفقیت به‌روزرسانی شد.</p>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary-500" />
              <h4 className="text-sm font-bold text-slate-800">تغییر رمز عبور</h4>
            </div>
            <div className="space-y-2.5">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="رمز عبور جدید"
                dir="ltr"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus-ring"
              />
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
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

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-700 text-white py-3 text-sm font-semibold hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/30 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'ذخیره تغییرات'
            )}
          </button>

          <button
            onClick={() => { signOut(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-red-500 transition-colors py-2"
          >
            <LogOut className="h-4 w-4" />
            خروج از حساب
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function MobileAccountDrawer({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setUser = useAuthStore((s) => s.setUser);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [error, setError] = useState('');
  const displayName = user?.full_name || user?.phone || 'کاربر';

  const handleSave = async () => {
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
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'تغییر رمز عبور انجام نشد.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="absolute left-0 top-0 flex h-full w-[min(86vw,360px)] flex-col overflow-hidden bg-white text-slate-900 shadow-2xl"
        dir="rtl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-[72px] shrink-0 items-center justify-between border-b border-slate-100 px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-white font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
              <p className="truncate text-xs text-slate-400" dir="ltr">{user?.phone ?? 'حساب کاربری'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
            aria-label="بستن منو"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-hidden bg-white px-4 py-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">شماره موبایل</label>
            <div className="relative">
              <Phone className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-500" />
              <input
                type="tel"
                value={user?.phone ?? ''}
                readOnly
                dir="ltr"
                className="w-full rounded-xl border border-primary-100 bg-white py-2 pl-4 pr-11 text-sm font-semibold text-slate-800 text-left outline-none"
              />
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">شماره موبایل قابل ویرایش نیست.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">نام و نام خانوادگی</label>
            <div className="relative">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="نام شما"
                dir="rtl"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-11 pl-4 text-sm text-slate-900 placeholder:text-slate-400 focus-ring"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2">
              <X className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <p className="text-xs text-green-600">اطلاعات حساب با موفقیت به‌روزرسانی شد.</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-700 text-white py-2.5 text-sm font-semibold hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/30 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'ذخیره تغییرات'}
          </button>

          <div className="border-t border-slate-100 pt-2.5">
            <div className="mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary-500" />
              <h4 className="text-sm font-bold text-slate-800">تغییر رمز عبور</h4>
            </div>
            <div className="space-y-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور جدید"
                dir="ltr"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-ring"
              />
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="تکرار رمز عبور جدید"
                dir="ltr"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-ring"
              />
              {passwordMessage && (
                <p className={`text-xs ${passwordMessage.includes('موفقیت') ? 'text-emerald-600' : 'text-red-500'}`}>
                  {passwordMessage}
                </p>
              )}
              <button
                onClick={handlePasswordChange}
                disabled={savingPassword}
                className="w-full rounded-xl bg-primary-700 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-700/20 transition-colors hover:bg-primary-800 disabled:opacity-50"
              >
                {savingPassword ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'تغییر رمز عبور'}
              </button>
            </div>
          </div>

          <button
            onClick={() => { signOut(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-red-500 transition-colors py-2"
          >
            <LogOut className="h-4 w-4" />
            خروج از حساب
          </button>
        </div>
      </motion.aside>
    </motion.div>
  );
}

export function Sidebar() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const openQuickAdd = useAppStore((s) => s.openQuickAdd);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const navItems = useNavItems();

  const displayName = user?.full_name || user?.phone || 'کاربر';

  return (
    <>
      <aside className="hidden lg:flex fixed top-0 right-0 h-screen w-72 flex-col border-l border-slate-200/70 bg-white/85 backdrop-blur-2xl z-40">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">یادتو</h1>
              <p className="text-[11px] font-medium text-primary-600">مدیر برنامه هوشمند</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-[10px] font-semibold text-accent-700 border border-accent-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-pulse" />
            AI
          </span>
        </div>

        <div className="px-4 pb-3">
          <button
            onClick={() => openQuickAdd('picker')}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-primary-600 to-primary-800 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-700/20 hover:shadow-primary-700/30 hover:brightness-105 active:scale-[0.99] transition-all"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            ثبت کار یا رویداد جدید
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'text-primary-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-2xl bg-primary-50/90 border border-primary-200/60"
                  />
                )}
                <Icon className={`relative z-10 h-5 w-5 ${active ? 'text-primary-600' : 'text-slate-400'}`} />
                <span className="relative z-10">{item.label}</span>
                {item.id === 'assistant' && (
                  <span className="relative z-10 mr-auto rounded-lg bg-accent-100/80 px-2 py-0.5 text-[10px] font-bold text-accent-700">
                    هوشمند
                  </span>
                )}
                {active && item.id !== 'assistant' && (
                  <span className="relative z-10 mr-auto h-1.5 w-1.5 rounded-full bg-primary-600" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-4 pb-5 space-y-3 border-t border-slate-100 pt-3">
          <CreditBadge />

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 p-4 text-white shadow-lg shadow-slate-900/15">
            <div className="absolute -left-6 -top-6 h-20 w-20 rounded-full bg-accent-400/15 blur-xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="h-4 w-4 text-accent-300" />
                <p className="text-xs font-bold">دستیار مدیر برنامه</p>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                زمان‌بندی، پیدا کردن وقت آزاد و ثبت با یک جمله فارسی
              </p>
              <button
                onClick={() => setPage('assistant')}
                className="mt-3 w-full rounded-xl bg-white/12 hover:bg-white/20 border border-white/10 transition-colors py-2 text-xs font-semibold"
              >
                باز کردن دستیار
              </button>
            </div>
          </div>

          {user && (
            <div className="rounded-2xl bg-surface/80 border border-slate-200/70 p-2.5 space-y-1">
              <button
                onClick={() => setPage(user?.is_admin ? 'admin' : 'account')}
                className="w-full flex items-center gap-3 text-right hover:bg-white rounded-xl p-2 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-700 to-primary-900 text-white text-sm font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {displayName}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.is_admin ? 'پنل مدیریت' : 'حساب کاربری'}</p>
                </div>
                {user?.is_admin ? <Shield className="h-4 w-4 text-slate-400 shrink-0" /> : <Settings className="h-4 w-4 text-slate-400 shrink-0" />}
              </button>

              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-2 text-xs text-slate-400 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50/70"
              >
                <LogOut className="h-3.5 w-3.5" />
                خروج از حساب
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function BottomNav() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const openQuickAdd = useAppStore((s) => s.openQuickAdd);

  // Symmetric 5-column layout so the Quick-Add (+) button is mathematically dead-center:
  // Right (RTL start): Home, Calendar | Center: (+) | Left (RTL end): Notes, Assistant
  const rightItems: NavItem[] = [
    baseNavItems[0], // خانه
    baseNavItems[1], // تقویم
  ];
  const leftItems: NavItem[] = [
    baseNavItems[3], // یادداشت
    { id: 'assistant', label: 'دستیار صوتی', icon: AudioLines }, // دستیار صوتی
  ];

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = currentPage === item.id;
    const isAssistant = item.id === 'assistant';
    return (
      <button
        key={item.id}
        onClick={() => setPage(item.id)}
        className="relative flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-all active:scale-95"
      >
        {active && (
          <motion.span
            layoutId="mobile-bottom-pill"
            transition={{ type: 'spring', stiffness: 450, damping: 34 }}
            className={`absolute inset-x-1 inset-y-0.5 rounded-2xl border ${
              isAssistant
                ? 'bg-gradient-to-b from-primary-50 to-accent-50/70 border-primary-200/70'
                : 'bg-primary-50/90 border-primary-100/80'
            }`}
          />
        )}
        <div
          className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-xl transition-transform duration-200 ${
            active
              ? 'text-primary-700 scale-110'
              : isAssistant
                ? 'text-primary-500'
                : 'text-slate-400'
          }`}
        >
          <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.3 : 1.9} />
          {isAssistant && !active && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-500 ring-2 ring-white" />
          )}
        </div>
        <span
          className={`relative z-10 text-[10px] leading-none transition-colors ${
            active
              ? 'font-bold text-primary-700'
              : isAssistant
                ? 'font-semibold text-primary-600'
                : 'font-medium text-slate-400'
          }`}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      aria-label="ناوبری موبایل"
      className="lg:hidden fixed inset-x-3 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-40 rounded-[26px] border border-slate-200/80 bg-white/95 backdrop-blur-2xl shadow-[0_10px_35px_-10px_rgba(15,23,42,0.18)] px-2 py-1.5"
    >
      <div className="grid grid-cols-5 items-center gap-1">
        {rightItems.map(renderNavItem)}

        {/* Mathematically Centered Quick-Add FAB */}
        <div className="flex items-center justify-center">
          <button
            onClick={() => openQuickAdd('picker')}
            className="relative -mt-7 flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-primary-500 via-primary-600 to-accent-500 text-white shadow-[0_10px_24px_-4px_rgba(99,102,241,0.55)] ring-4 ring-white transition-all active:scale-95 hover:scale-105"
            aria-label="افزودن کار، رویداد یا یادداشت"
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </button>
        </div>

        {leftItems.map(renderNavItem)}
      </div>
    </nav>
  );
}
