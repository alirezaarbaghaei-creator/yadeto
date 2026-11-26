import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { App as CapacitorApp } from '@capacitor/app';
import { Sidebar, BottomNav } from '@/components/Navigation';
import { MobileHeader } from '@/components/MobileHeader';
import { Dashboard } from '@/pages/Dashboard';
import { CalendarPage } from '@/pages/CalendarPage';
import { TasksPage } from '@/pages/TasksPage';
import { NotesPage } from '@/pages/NotesPage';
import { AssistantPage } from '@/pages/AssistantPage';
import { AuthPage } from '@/pages/AuthPage';
import { AdminPage } from '@/pages/AdminPage';
import { AccountPage } from '@/pages/AccountPage';
import { PricingPage } from '@/pages/PricingPage';
import { PaymentCallback } from '@/pages/PaymentCallback';
import { PaymentResult } from '@/pages/PaymentResult';
import { UpgradeModal } from '@/components/UpgradeModal';
import { QuickAddModal } from '@/components/QuickAddModal';
import { AlarmOverlay } from '@/components/AlarmOverlay';
import { startReminderWatcher, requestNotificationPermissions, syncNativeAlarms, consumeNotificationCompletedTasks } from '@/services/calendar/notifications';
import { syncAndroidStatusAndWidgets } from '@/services/calendar/androidStatus';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useDeepLinks, parseDeepLink } from '@/hooks/useDeepLinks';
import { initPushNotifications, cleanupPushNotifications } from '@/services/pushNotifications';
import { IntroTour, INTRO_SEEN_KEY } from '@/components/IntroTour';
import { getItem as getStoredItem, setItem as setStoredItem } from '@/lib/safeStorage';
import { installDiagnostics } from '@/services/diagnostics';

// Install the global error capture at module load, before React mounts, so early
// failures are recorded too. Safe to call repeatedly.
installDiagnostics();

function AppShell() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const refresh = useCalendarStore((s) => s.refresh);
  const loaded = useCalendarStore((s) => s.loaded);
  const tasks = useCalendarStore((s) => s.tasks);
  const events = useCalendarStore((s) => s.events);
  const preferences = useCalendarStore((s) => s.preferences);

  useEffect(() => {
    void syncAndroidStatusAndWidgets(
      tasks,
      events,
      preferences?.workStart ?? '08:00',
      preferences?.workEnd ?? '20:00',
    );
    const defaultMin = preferences?.defaultReminder ?? 15;
    const enabled = preferences?.notificationsEnabled !== false;
    const items = [
      ...tasks
        .filter((t) => t.status === 'pending' && t.dueTime)
        .map((t) => ({
          id: t.id,
          title: t.title,
          date: t.dueDate,
          time: t.dueTime,
          reminder: t.reminder ?? defaultMin,
          kind: 'task' as const,
        })),
      ...events.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.startTime,
        reminder: e.reminder ?? defaultMin,
        kind: 'event' as const,
      })),
    ];
    void syncNativeAlarms(items, enabled);
  }, [tasks, events, preferences]);

  // Keep date, time, persistent notification, and notification-completed tasks in sync
  useEffect(() => {
    const syncCompletedFromNotif = async () => {
      const doneIds = await consumeNotificationCompletedTasks();
      if (doneIds.length > 0) {
        const st = useCalendarStore.getState();
        for (const id of doneIds) {
          const task = st.tasks.find((t) => t.id === id);
          if (task && task.status !== 'completed') {
            st.toggleTask(id);
          }
        }
      }
    };

    const handleClockTick = () => {
      void syncCompletedFromNotif();
      const st = useCalendarStore.getState();
      void syncAndroidStatusAndWidgets(
        st.tasks,
        st.events,
        st.preferences?.workStart ?? '08:00',
        st.preferences?.workEnd ?? '20:00',
      );
    };

    void syncCompletedFromNotif();

    // Sync every minute on device clock
    const interval = setInterval(handleClockTick, 60_000);

    // Sync immediately when app returns to foreground from background
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleClockTick();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Track whether we're showing a standalone payment page (not part of the SPA)
  const [paymentView, setPaymentView] = useState<'callback' | 'result' | null>(() => {
    const path = window.location.pathname;
    if (path === '/payment/callback') return 'callback';
    if (path === '/payment/result') return 'result';
    return null;
  });

  // First-run onboarding: shown once before the login page, then remembered
  // in safeStorage (memory fallback on WebViews where localStorage is blocked).
  const [introSeen, setIntroSeen] = useState(() => getStoredItem(INTRO_SEEN_KEY) === '1');

  const handleIntroDone = () => {
    setStoredItem(INTRO_SEEN_KEY, '1');
    setIntroSeen(true);
  };

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Request notification permission on startup so sticky status bar & alarms work immediately
  useEffect(() => {
    requestNotificationPermissions()
      .then((granted) => {
        if (granted) {
          const st = useCalendarStore.getState();
          void syncAndroidStatusAndWidgets(
            st.tasks,
            st.events,
            st.preferences?.workStart ?? '08:00',
            st.preferences?.workEnd ?? '20:00',
          );
        }
      })
      .catch(() => {});
  }, []);

  // Initialize FCM push notifications on native (Android) builds.
  useEffect(() => {
    initPushNotifications().catch((err) => {
      console.error('[SmartCalendar] Push init failed', err);
    });
    return () => {
      cleanupPushNotifications().catch(() => {});
    };
  }, []);

  // Watch tasks & events for due reminder alarms & notifications
  useEffect(() => {
    return startReminderWatcher(() => {
      const state = useCalendarStore.getState();
      const prefs = state.preferences;
      if (prefs && prefs.notificationsEnabled === false) return [];
      const defaultMin = prefs?.defaultReminder ?? 15;
      const items = [
        ...state.tasks
          .filter((t) => t.status === 'pending' && t.dueTime)
          .map((t) => ({
            id: t.id,
            title: t.title,
            date: t.dueDate,
            time: t.dueTime,
            reminder: t.reminder ?? defaultMin,
            kind: 'task' as const,
          })),
        ...state.events.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          time: e.startTime,
          reminder: e.reminder ?? defaultMin,
          kind: 'event' as const,
        })),
      ];
      return items;
    });
  }, []);

  // Load calendar data (local-first; cloud sync kicks in when a session exists)
  useEffect(() => {
    if (!loaded) {
      refresh().catch((err) => {
        console.warn('[SmartCalendar] calendar refresh failed', err);
      });
    }
  }, [loaded, refresh]);

  // Handle deep links from Capacitor (Android)
  useDeepLinks((url) => {
    const parsed = parseDeepLink(url);
    if (!parsed) return;
    let { pathname, search } = parsed;

    // Normalize YADETO://payment/callback → /payment/callback
    if (pathname === '/callback') pathname = '/payment/callback';
    if (pathname === '/result') pathname = '/payment/result';

    if (pathname === '/payment/callback') {
      const queryString = search.toString();
      const newUrl = queryString ? `/payment/callback?${queryString}` : '/payment/callback';
      window.history.replaceState({}, '', newUrl);
      setPaymentView('callback');
    } else if (pathname === '/payment/result') {
      const orderId = search.get('order_id');
      const newUrl = orderId
        ? `/payment/result?order_id=${orderId}`
        : '/payment/result';
      window.history.replaceState({}, '', newUrl);
      setPaymentView('result');
    }
  });

  // Handle Android back button
  useEffect(() => {
    let listener: { remove: () => Promise<void> } | null = null;
    try {
      CapacitorApp.addListener('backButton', () => {
        // If we're on a sub-page, go back to home
        if (currentPage !== 'home') {
          setPage('home');
        } else {
          // On home, exit the app
          CapacitorApp.exitApp().catch((error: unknown) => {
            console.error('[SmartCalendar] app exit failed', error);
          });
        }
      })
        .then((l) => { listener = l; })
        .catch((error: unknown) => {
          console.error('[SmartCalendar] back-button listener unavailable', error);
        });
    } catch (error) {
      console.error('[SmartCalendar] back-button initialization failed', error);
    }

    return () => {
      if (listener) listener.remove().catch(() => {});
    };
  }, [currentPage, setPage]);

  // Payment callback route: standalone page, no auth required
  if (paymentView === 'callback') {
    return <PaymentCallback onDone={(oid) => {
      const newUrl = oid ? `/payment/result?order_id=${oid}` : '/payment/result';
      window.history.replaceState({}, '', newUrl);
      setPaymentView('result');
    }} />;
  }

  // Payment result route: standalone page, no auth required
  if (paymentView === 'result') {
    return <PaymentResult onDone={() => {
      window.history.replaceState({}, '', '/');
      setPaymentView(null);
    }} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-primary-950 to-slate-900 p-6 relative overflow-hidden">
        {/* Ambient glowing blobs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-600/25 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl animate-pulse" />

        <div className="relative flex flex-col items-center">
          {/* Orbiting ring */}
          <div className="relative flex h-28 w-28 items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.6, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-400 border-r-primary-400"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
              className="absolute inset-2 rounded-full border border-transparent border-b-primary-300/60 border-l-accent-300/60"
            />
            <motion.img
              src="/logo.png"
              alt="Yadeto"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="h-16 w-16 rounded-2xl object-cover shadow-2xl shadow-primary-500/40 bg-white"
            />
          </div>

          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-6 text-2xl font-black tracking-tight bg-gradient-to-l from-white via-primary-200 to-accent-300 bg-clip-text text-transparent"
          >
            یادتو
          </motion.h2>
          <p className="mt-1.5 text-xs font-medium text-slate-300/80">
            در حال آماده‌سازی دستیار و تقویم هوشمند...
          </p>

          {/* Animated shimmer progress bar */}
          <div className="mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
              className="h-full w-1/2 rounded-full bg-gradient-to-r from-primary-400 via-accent-400 to-primary-400"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    // First launch: multi-step intro first, login page only after it's done
    // (or skipped). The seen-flag makes sure it never shows a second time.
    if (!introSeen) {
      return <IntroTour onDone={handleIntroDone} />;
    }
    return <AuthPage />;
  }

  const pages: Record<string, React.ReactNode> = {
    home: <Dashboard />,
    calendar: <CalendarPage />,
    tasks: <TasksPage />,
    notes: <NotesPage />,
    assistant: <AssistantPage />,
    admin: <AdminPage />,
    account: <AccountPage />,
    pricing: <PricingPage />,
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Ambient background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary-200/25 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-96 w-96 rounded-full bg-accent-200/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-80 w-80 rounded-full bg-primary-100/30 blur-3xl" />
      </div>

      <Sidebar />
      <MobileHeader />

      <main className="relative lg:mr-72">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-32 lg:pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {pages[currentPage] ?? <Dashboard />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <BottomNav />
      <QuickAddModal />
      <UpgradeModal />
      <AlarmOverlay />
    </div>
  );
}

// Kept as a thin wrapper so the root stays a stable mount point.
function App() {
  return <AppShell />;
}

export default App;
