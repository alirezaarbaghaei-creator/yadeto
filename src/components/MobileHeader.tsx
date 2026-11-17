import { Sparkles, User, Shield } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { CreditBadge } from '@/components/CreditBadge';

export function MobileHeader({ anonymous = false }: { anonymous?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const setPage = useAppStore((s) => s.setPage);
  const displayName = user?.full_name || user?.phone || 'کاربر';

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/50">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-700 to-primary-900 shadow-md shadow-primary-900/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none text-slate-900">یادتو</h1>
            <p className="mt-0.5 text-[10px] text-slate-500">همراه هوشمند زندگی تو</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!anonymous && <CreditBadge compact />}
          {anonymous ? (
            <button
              onClick={() => setPage('assistant')}
              className="rounded-xl bg-primary-700 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-primary-700/25"
            >
              ورود به دستیار
            </button>
          ) : (
          <button
            onClick={() => setPage(user?.is_admin ? 'admin' : 'account')}
            className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-50"
            aria-label={user?.is_admin ? 'پنل مدیریت' : 'حساب کاربری'}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-700 to-primary-900 text-white text-sm font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 text-right hidden sm:block">
              <p className="max-w-[92px] truncate text-xs font-semibold text-slate-700">{displayName}</p>
              <p className="max-w-[110px] truncate text-[10px] text-slate-400" dir="ltr">{user?.phone || 'حساب کاربری'}</p>
            </div>
            {user?.is_admin ? <Shield className="h-4 w-4 shrink-0 text-slate-400" /> : <User className="h-4 w-4 shrink-0 text-slate-400" />}
          </button>
          )}
        </div>
      </div>
    </header>
  );
}
