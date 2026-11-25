import { User, Shield, Mic, ListTodo } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { CreditBadge } from '@/components/CreditBadge';

export function MobileHeader({ anonymous = false }: { anonymous?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const launchAiVoice = useAppStore((s) => s.launchAiVoice);
  const displayName = user?.full_name || user?.phone || 'کاربر';

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/50">
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Yadeto"
            className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm border border-primary-100 bg-white"
          />
          <div>
            <h1 className="text-base font-bold leading-none text-slate-900">یادتو</h1>
            <p className="mt-0.5 text-[10px] text-primary-600 font-medium">مدیر برنامه هوشمند</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!anonymous && (
            <>
              <button
                onClick={launchAiVoice}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 px-2.5 py-2 text-xs font-bold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95"
                aria-label="گفتگوی صوتی با دستیار"
                title="مکالمه صوتی با دستیار"
              >
                <Mic className="h-3.5 w-3.5" />
                <span className="text-[11px]">صوتی</span>
              </button>
              <button
                onClick={() => setPage('tasks')}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                  currentPage === 'tasks'
                    ? 'border-primary-200 bg-primary-50 text-primary-700'
                    : 'border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50'
                }`}
                aria-label="کارها"
                title="کارها"
              >
                <ListTodo className="h-4 w-4" />
              </button>
              <CreditBadge compact />
            </>
          )}
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
            className="flex min-w-0 items-center gap-1.5 rounded-xl px-1.5 py-1 transition-colors hover:bg-slate-50"
            aria-label={user?.is_admin ? 'پنل مدیریت' : 'حساب کاربری'}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-700 to-primary-900 text-white text-xs font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 text-right hidden sm:block">
              <p className="max-w-[92px] truncate text-xs font-semibold text-slate-700">{displayName}</p>
              <p className="max-w-[110px] truncate text-[10px] text-slate-400" dir="ltr">{user?.phone || 'حساب کاربری'}</p>
            </div>
            {user?.is_admin ? <Shield className="h-4 w-4 shrink-0 text-slate-400" /> : <User className="h-4 w-4 shrink-0 text-slate-400 hidden sm:block" />}
          </button>
          )}
        </div>
      </div>
    </header>
  );
}
