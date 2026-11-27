import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, BatteryCharging, AlarmClock, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { isNativeApp } from '@/lib/capacitor';
import { getItem, setItem } from '@/lib/safeStorage';
import { requestNotificationPermissions } from '@/services/calendar/notifications';

interface PermState {
  notifications: boolean;
  exactAlarm: boolean;
  batteryIgnored: boolean;
  fullScreenIntent: boolean;
  allGranted: boolean;
}

const DISMISS_KEY = 'YADETO_alarm_perm_prompt_dismissed';

function getPlugin() {
  const cap = (window as unknown as {
    Capacitor?: {
      Plugins?: {
        YadetoStatus?: {
          checkAlarmPermissions?: () => Promise<PermState>;
          requestAlarmPermission?: (opts: { type: string }) => Promise<void>;
        };
      };
    };
  }).Capacitor;
  return cap?.Plugins?.YadetoStatus ?? null;
}

export function AlarmPermissionModal() {
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<PermState | null>(null);

  const refreshPerms = useCallback(async () => {
    if (!isNativeApp()) return;
    const plugin = getPlugin();
    if (!plugin?.checkAlarmPermissions) return;
    try {
      const res = await plugin.checkAlarmPermissions();
      setPerms(res);
      if (res.allGranted) {
        setOpen(false);
      } else if (getItem(DISMISS_KEY) !== '1') {
        setOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPerms();
    }, 1200);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshPerms();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshPerms]);

  const handleDismiss = () => {
    setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  const handleRequest = async (type: 'notifications' | 'battery' | 'exactAlarm' | 'fullScreenIntent') => {
    if (type === 'notifications') {
      const ok = await requestNotificationPermissions();
      if (ok) {
        await refreshPerms();
        return;
      }
    }
    await getPlugin()?.requestAlarmPermission?.({ type });
  };

  if (!open || !perms || perms.allGranted) return null;

  const items = [
    {
      key: 'notifications' as const,
      granted: perms.notifications,
      title: 'نمایش اعلان‌ها',
      desc: 'برای نمایش یادآوری و دکمه‌های توقف در نوار اعلان',
      icon: BellRing,
    },
    {
      key: 'battery' as const,
      granted: perms.batteryIgnored,
      title: 'اجرای بدون محدودیت باتری',
      desc: 'برای زنگ خوردن آلارم حتی وقتی برنامه بسته است',
      icon: BatteryCharging,
    },
    {
      key: 'exactAlarm' as const,
      granted: perms.exactAlarm,
      title: 'زمان‌بندی دقیق آلارم',
      desc: 'برای به صدا درآمدن زنگ سر ثانیه مشخص',
      icon: AlarmClock,
    },
    {
      key: 'fullScreenIntent' as const,
      granted: perms.fullScreenIntent,
      title: 'نمایش تمام‌صفحه روی صفحه قفل',
      desc: 'برای باز شدن صفحه یادآوری روی قفل گوشی',
      icon: ShieldAlert,
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 text-white shadow-md">
                <AlarmClock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">فعال‌سازی زنگ و یادآوری پس‌زمینه</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  برای اینکه آلارم‌ها حتی وقتی برنامه بسته است زنگ بخورند، این دسترسی‌ها را فعال کنید:
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="بستن"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${
                    item.granted
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        item.granted ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-50 text-primary-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800">{item.title}</p>
                      <p className="text-[10px] text-slate-500 truncate">{item.desc}</p>
                    </div>
                  </div>
                  {item.granted ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                      فعال
                    </span>
                  ) : (
                    <button
                      onClick={() => void handleRequest(item.key)}
                      className="shrink-0 rounded-xl bg-primary-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary-800 transition-colors"
                    >
                      فعال‌سازی
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleDismiss}
            className="w-full rounded-2xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            بعداً انجام می‌دهم
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
