import { isNativeApp } from '@/lib/capacitor';
import { getItem, setItem } from '@/lib/safeStorage';
import type { CalendarEvent, Task } from '@/types/calendar';
import { getVisibleTasksForDate, getTodaySchedule } from './schedulingEngine';
import { formatJalali, getTodayISO, getTodayJalali, toFaDigits } from '@/utils/jalaliDate';
import { getYadetoStatusPlugin } from '@/services/yadetoStatusPlugin';

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
    const plugin = getYadetoStatusPlugin();
    if (!plugin) return;

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

    await plugin.updateStatus({
      dateLabel,
      summaryLine: summaryParts.join(' • '),
      detailsText: detailLines.join('\n'),
      stickyEnabled: isStickyStatusEnabled(),
    });
  } catch (err) {
    console.warn('[YadetoStatus] sync failed', err);
  }
}
