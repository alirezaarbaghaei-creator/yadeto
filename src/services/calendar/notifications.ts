/**
 * Reminder notifications for the Smart Calendar.
 *
 * Native (Android): Capacitor LocalNotifications — OS-level scheduled alarms
 * that survive the app being closed. The plugin auto-registers in Capacitor 8.
 * Web: Notification API + in-process timers (works while the app is open).
 */
import { isNativeApp } from '@/lib/capacitor';

const timers = new Map<string, number>();
const firedKeys = new Set<string>();

export interface ActiveAlarm {
  id: string;
  title: string;
  body: string;
  triggeredAt: number;
}

type AlarmListener = (alarm: ActiveAlarm) => void;
const alarmListeners = new Set<AlarmListener>();

export function subscribeToAlarms(listener: AlarmListener): () => void {
  alarmListeners.add(listener);
  return () => {
    alarmListeners.delete(listener);
  };
}

export function playAlarmSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [587.33, 783.99, 987.77]; // D5, G5, B5 pleasant chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.16;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  } catch {
    /* ignore audio context restrictions */
  }
}

export function triggerAlarm(title: string, body: string): void {
  playAlarmSound();
  showNotification(title, body);
  const alarm: ActiveAlarm = {
    id: `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    body,
    triggeredAt: Date.now(),
  };
  for (const listener of alarmListeners) {
    listener(alarm);
  }
}

export function snoozeAlarm(alarm: ActiveAlarm, minutes = 10): void {
  const handle = window.setTimeout(() => {
    triggerAlarm(alarm.title, `${alarm.body} (یادآوری مجدد)`);
  }, minutes * 60 * 1000);
  timers.set(`snooze-${alarm.id}`, handle);
}

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
      triggerAlarm(title, body);
    },
    Math.min(delay, MAX_DELAY),
  );
  timers.set(id, handle);
  return id;
}

export interface WatchableReminderItem {
  id: string;
  title: string;
  date: string;
  time?: string;
  reminder?: number;
  kind: 'task' | 'event';
}

/**
 * Periodically checks tasks/events so alarms & notifications fire reliably even
 * if the item was created before page reload.
 */
export function startReminderWatcher(getItems: () => WatchableReminderItem[]): () => void {
  if (typeof window === 'undefined') return () => {};

  const check = () => {
    const now = Date.now();
    for (const item of getItems()) {
      if (!item.date || !item.time) continue;
      if (item.reminder !== undefined && item.reminder < 0) continue;
      const minsBefore = item.reminder ?? 15;
      const [y, m, d] = item.date.split('-').map(Number);
      const [hh, mm] = item.time.split(':').map(Number);
      if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) continue;

      const triggerMs = new Date(y, m - 1, d, hh, mm, 0).getTime() - minsBefore * 60 * 1000;
      const key = `${item.kind}:${item.id}:${triggerMs}`;
      if (firedKeys.has(key)) continue;

      // Fire if we are within [triggerMs, triggerMs + 60s]
      if (now >= triggerMs && now <= triggerMs + 60_000) {
        firedKeys.add(key);
        const body =
          minsBefore > 0
            ? `${minsBefore} دقیقه تا «${item.title}» باقی مانده.`
            : `وقت «${item.title}» رسید.`;
        triggerAlarm(item.kind === 'event' ? 'آلارم رویداد' : 'آلارم کار', body);
      }
    }
  };

  const intervalId = window.setInterval(check, 15_000);
  check();
  return () => window.clearInterval(intervalId);
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
