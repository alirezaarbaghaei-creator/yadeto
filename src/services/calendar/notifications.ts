/**
 * Reminder notifications for the Smart Calendar.
 *
 * Native (Android): Capacitor LocalNotifications — OS-level scheduled alarms
 * that survive the app being closed. The plugin auto-registers in Capacitor 8.
 * Web: Notification API + in-process timers (works while the app is open).
 */
import { isNativeApp } from '@/lib/capacitor';

const timers = new Map<string, number>();

// ─── native (Capacitor) ───────────────────────────────────────

async function nativeAvailable(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const mod = await import('@capacitor/local-notifications');
    return !!mod.LocalNotifications;
  } catch {
    return false;
  }
}

async function nativeRequestPermissions(): Promise<boolean> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch (e) {
    console.warn('[SmartCalendar] native notification permission failed', e);
    return false;
  }
}

async function nativeSchedule(
  id: number,
  title: string,
  body: string,
  trigger: Date,
): Promise<void> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        schedule: { at: trigger, allowWhileIdle: true },
        sound: 'default',
        smallIcon: 'ic_launcher',
        largeIcon: 'icon-512',
      },
    ],
  });
}

async function nativeCancel(id: number): Promise<void> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    /* ignore */
  }
}

/** Stable numeric id from a string id (LocalNotifications requires ints). */
function numericId(strId: string): number {
  let h = 0;
  for (let i = 0; i < strId.length; i++) h = (h * 31 + strId.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

// ─── web (Notification API) ───────────────────────────────────

function notificationsAvailable(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function showNotification(title: string, body: string): void {
  if (!notificationsAvailable() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icon.png' });
  } catch (e) {
    console.warn('[SmartCalendar] showNotification error', e);
  }
}

// ─── public API ───────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (await nativeAvailable()) return nativeRequestPermissions();
  if (!notificationsAvailable()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (e) {
    console.warn('[SmartCalendar] requestNotificationPermissions error', e);
    return false;
  }
}

export function cancelReminder(notificationId: string): void {
  void nativeCancel(numericId(notificationId));
  const t = timers.get(notificationId);
  if (t !== undefined) {
    window.clearTimeout(t);
    timers.delete(notificationId);
  }
}

export function cancelAllReminders(): void {
  for (const id of timers.keys()) void nativeCancel(numericId(id));
  for (const t of timers.values()) window.clearTimeout(t);
  timers.clear();
}

/**
 * Schedule a local reminder. Returns an id (or null when the trigger is in
 * the past / notifications unavailable).
 */
export async function scheduleReminder(
  title: string,
  body: string,
  triggerDate: string,
  triggerTime: string,
): Promise<string | null> {
  const [year, month, day] = triggerDate.split('-').map(Number);
  const [hour, minute] = triggerTime.split(':').map(Number);
  const trigger = new Date(year, month - 1, day, hour, minute, 0);

  if (trigger.getTime() <= Date.now()) return null;

  const id = `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (await nativeAvailable()) {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;
    try {
      await nativeSchedule(numericId(id), title, body, trigger);
      return id;
    } catch (e) {
      console.warn('[SmartCalendar] native schedule failed, falling back to timer', e);
    }
  }

  if (!notificationsAvailable()) return null;
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  const delay = trigger.getTime() - Date.now();
  // setTimeout max is ~24.8 days — anything beyond that fires at start-up instead
  const MAX_DELAY = 2_147_483_647;
  const handle = window.setTimeout(
    () => {
      timers.delete(id);
      showNotification(title, body);
    },
    Math.min(delay, MAX_DELAY),
  );
  timers.set(id, handle);
  return id;
}

export async function scheduleTaskReminder(
  taskTitle: string,
  dueDate: string,
  dueTime: string,
  minutesBefore = 15,
): Promise<string | null> {
  if (!dueDate || !dueTime) return null;

  const [year, month, day] = dueDate.split('-').map(Number);
  const [hour, minute] = dueTime.split(':').map(Number);
  const taskTime = new Date(year, month - 1, day, hour, minute, 0);
  taskTime.setMinutes(taskTime.getMinutes() - minutesBefore);

  if (taskTime.getTime() <= Date.now()) return null;

  const triggerDate = `${taskTime.getFullYear()}-${String(taskTime.getMonth() + 1).padStart(2, '0')}-${String(taskTime.getDate()).padStart(2, '0')}`;
  const triggerTime = `${String(taskTime.getHours()).padStart(2, '0')}:${String(taskTime.getMinutes()).padStart(2, '0')}`;

  const body =
    minutesBefore > 0
      ? `${minutesBefore} دقیقه تا «${taskTitle}» باقی مانده.`
      : `وقت «${taskTitle}» رسید.`;

  return scheduleReminder('یادآوری تقویم هوشمند', body, triggerDate, triggerTime);
}

export const scheduleEventReminder = scheduleTaskReminder;
