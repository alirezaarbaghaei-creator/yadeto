import { isNativeApp } from '@/lib/capacitor';
import { getItem, setItem } from '@/lib/safeStorage';
import type { CalendarEvent, Task } from '@/types/calendar';
import { getVisibleTasksForDate, getTodaySchedule, formatFreeTime } from './schedulingEngine';
import { formatJalali, getTodayISO, getTodayJalali, toFaDigits } from '@/utils/jalaliDate';

const STICKY_NOTIF_KEY = 'YADETO_sticky_status_notif';

export function isStickyStatusEnabled(): boolean {
  return getItem(STICKY_NOTIF_KEY) !== '0';
}

export function setStickyStatusEnabled(enabled: boolean): void {
  setItem(STICKY_NOTIF_KEY, enabled ? '1' : '0');
}

export async function syncAndroidStatusAndWidgets(
  tasks: Task[],
  events: CalendarEvent[],
  workStart = '08:00',
  workEnd = '20:00',
): Promise<void> {
  if (!isNativeApp()) return;

  try {
    const cap = (window as unknown as {
      Capacitor?: {
        Plugins?: {
          YadetoStatus?: {
            updateStatus?: (opts: {
              dateLabel: string;
              summaryLine: string;
              detailsText: string;
              stickyEnabled: boolean;
            }) => Promise<void>;
          };
        };
      };
    }).Capacitor;

    const updateStatus = cap?.Plugins?.YadetoStatus?.updateStatus;
    if (typeof updateStatus !== 'function') return;

    const today = getTodayJalali();
    const todayISO = getTodayISO();
    const dateLabel = formatJalali(today, 'full');

    const visibleToday = getVisibleTasksForDate(tasks, todayISO);
    const pendingTasks = visibleToday.filter((t) => t.status === 'pending');
    const todayEvents = events
      .filter((e) => e.date === todayISO)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const schedule = getTodaySchedule(events, visibleToday, workStart, workEnd);

    const summaryParts = [
      `${toFaDigits(String(pendingTasks.length))} کار مانده`,
      `${toFaDigits(String(todayEvents.length))} رویداد`,
      `زمان آزاد: ${formatFreeTime(schedule.freeMinutes)}`,
    ];

    const detailLines: string[] = [];
    for (const item of schedule.items.slice(0, 4)) {
      detailLines.push(`• ${toFaDigits(item.time)} — ${item.title}`);
    }
    if (detailLines.length < 4) {
      for (const t of pendingTasks.filter((x) => !x.dueTime).slice(0, 4 - detailLines.length)) {
        detailLines.push(`• ${t.title}`);
      }
    }

    await updateStatus({
      dateLabel,
      summaryLine: summaryParts.join(' • '),
      detailsText: detailLines.join('\n'),
      stickyEnabled: isStickyStatusEnabled(),
    });
  } catch (err) {
    console.warn('[YadetoStatus] sync failed', err);
  }
}
