/**
 * Reminder notifications for the Smart Calendar.
 *
 * Native (Android): Capacitor LocalNotifications — OS-level scheduled alarms
 * that survive the app being closed. The plugin auto-registers in Capacitor 8.
 * Web: Notification API + in-process timers (works while the app is open).
 */
import { isNativeApp } from '@/lib/capacitor';
import { getItem, setItem } from '@/lib/safeStorage';

const timers = new Map<string, number>();
const firedKeys = new Set<string>();

export type AlarmSoundId = 'classic' | 'chime' | 'digital' | 'marimba';

export const ALARM_SOUNDS: { id: AlarmSoundId; label: string; desc: string }[] = [
  { id: 'classic', label: 'زنگ کلاسیک ساعت', desc: 'پالس دوگانه بیدارباش' },
  { id: 'chime', label: 'ملودی آرام', desc: 'آکورد ملایم و دلنشین' },
  { id: 'digital', label: 'دیجیتال سریع', desc: 'بیپ‌های دقیق و واضح' },
  { id: 'marimba', label: 'ماریمبا', desc: 'ریتم گرم و مدرن' },
];

const ALARM_SOUND_KEY = 'YADETO_alarm_sound';
const ALARM_VIBRATE_KEY = 'YADETO_alarm_vibrate';

function getYadetoStatusPlugin() {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as {
    Capacitor?: {
      Plugins?: {
        YadetoStatus?: {
          saveAlarmPrefs?: (opts: { soundId: string; vibrate: boolean }) => Promise<void>;
          scheduleAlarm?: (opts: {
            alarmId: number;
            title: string;
            body: string;
            triggerAtMs: number;
            soundId: string;
            vibrate: boolean;
            itemId?: string;
            kind?: string;
          }) => Promise<void>;
          cancelAlarm?: (opts: { alarmId: number }) => Promise<void>;
          stopActiveAlarm?: () => Promise<void>;
          consumeCompletedTasks?: () => Promise<{ ids?: string[] }>;
        };
      };
    };
  }).Capacitor;
  return cap?.Plugins?.YadetoStatus ?? null;
}

export function getSavedAlarmSound(): AlarmSoundId {
  const raw = getItem(ALARM_SOUND_KEY);
  if (raw === 'classic' || raw === 'chime' || raw === 'digital' || raw === 'marimba') return raw;
  return 'classic';
}

export function setSavedAlarmSound(id: AlarmSoundId): void {
  setItem(ALARM_SOUND_KEY, id);
  void getYadetoStatusPlugin()?.saveAlarmPrefs?.({
    soundId: id,
    vibrate: getAlarmVibrationEnabled(),
  });
}

export function getAlarmVibrationEnabled(): boolean {
  return getItem(ALARM_VIBRATE_KEY) !== '0';
}

export function setAlarmVibrationEnabled(enabled: boolean): void {
  setItem(ALARM_VIBRATE_KEY, enabled ? '1' : '0');
  void getYadetoStatusPlugin()?.saveAlarmPrefs?.({
    soundId: getSavedAlarmSound(),
    vibrate: enabled,
  });
}

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

let activeAudioCtx: AudioContext | null = null;
let alarmLoopTimer: number | null = null;

function playTonePattern(soundId: AlarmSoundId): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!activeAudioCtx || activeAudioCtx.state === 'closed') {
      activeAudioCtx = new AudioCtx();
    }
    if (activeAudioCtx.state === 'suspended') {
      void activeAudioCtx.resume();
    }
    const ctx = activeAudioCtx;

    const scheduleTone = (
      freq: number,
      offset: number,
      dur: number,
      type: OscillatorType,
      peak = 0.25,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const start = ctx.currentTime + offset;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };

    if (soundId === 'classic') {
      [0, 0.22, 0.44, 0.8].forEach((offset) => scheduleTone(880, offset, 0.16, 'triangle', 0.28));
    } else if (soundId === 'digital') {
      [0, 0.14, 0.28, 0.55, 0.69].forEach((offset) => scheduleTone(1174.66, offset, 0.1, 'square', 0.16));
    } else if (soundId === 'marimba') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
        scheduleTone(freq, i * 0.15, 0.22, 'sine', 0.28),
      );
    } else {
      // chime
      [587.33, 783.99, 987.77].forEach((freq, i) =>
        scheduleTone(freq, i * 0.18, 0.35, 'sine', 0.22),
      );
    }
  } catch {
    /* ignore audio context restrictions */
  }
}

export function playAlarmSound(soundId?: AlarmSoundId): void {
  const id = soundId ?? getSavedAlarmSound();
  playTonePattern(id);
  if (getAlarmVibrationEnabled() && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([450, 200, 450]);
    } catch {
      /* ignore vibrate errors */
    }
  }
}

export function previewAlarmSound(soundId: AlarmSoundId): void {
  playAlarmSound(soundId);
}

export function startAlarmLoop(soundId?: AlarmSoundId): void {
  stopAlarmLoop();
  const id = soundId ?? getSavedAlarmSound();
  playAlarmSound(id);
  if (typeof window !== 'undefined') {
    alarmLoopTimer = window.setInterval(() => {
      playAlarmSound(id);
    }, 1800);
  }
}

export function stopAlarmLoop(): void {
  if (alarmLoopTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(alarmLoopTimer);
    alarmLoopTimer = null;
  }
  if (activeAudioCtx) {
    try {
      void activeAudioCtx.close();
    } catch {
      /* ignore */
    }
    activeAudioCtx = null;
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  }
  void getYadetoStatusPlugin()?.stopActiveAlarm?.();
}

export async function consumeNotificationCompletedTasks(): Promise<string[]> {
  try {
    const res = await getYadetoStatusPlugin()?.consumeCompletedTasks?.();
    return Array.isArray(res?.ids) ? res.ids : [];
  } catch {
    return [];
  }
}

export function triggerAlarm(title: string, body: string): void {
  startAlarmLoop();
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
  stopAlarmLoop();
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
function toLatinDigits(str: string): string {
  return str
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

export async function scheduleReminder(
  title: string,
  body: string,
  triggerDate: string,
  triggerTime: string,
): Promise<string | null> {
  const [year, month, day] = toLatinDigits(triggerDate.slice(0, 10)).split('-').map(Number);
  const [hour, minute] = toLatinDigits(triggerTime).split(':').map(Number);
  const trigger = new Date(year, month - 1, day, hour, minute, 0);

  if (trigger.getTime() <= Date.now()) return null;

  const id = `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (await nativeAvailable()) {
    void requestNotificationPermissions().catch(() => {});
    const statusPlugin = getYadetoStatusPlugin();
    if (statusPlugin?.scheduleAlarm) {
      try {
        await statusPlugin.scheduleAlarm({
          alarmId: numericId(id),
          title,
          body,
          triggerAtMs: trigger.getTime(),
          soundId: getSavedAlarmSound(),
          vibrate: getAlarmVibrationEnabled(),
        });
        return id;
      } catch (e) {
        console.warn('[SmartCalendar] native AlarmManager schedule failed, falling back', e);
      }
    }
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
      const [y, m, d] = toLatinDigits(item.date.slice(0, 10)).split('-').map(Number);
      const [hh, mm] = toLatinDigits(item.time).split(':').map(Number);
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

const syncedNativeAlarmIds = new Set<number>();

/**
 * Syncs all upcoming task & event alarms directly to Android's native AlarmManager
 * so reminders & full-screen alarms reliably fire even when the app is completely closed.
 */
export async function syncNativeAlarms(
  items: WatchableReminderItem[],
  enabled = true,
): Promise<void> {
  if (!(await nativeAvailable())) return;
  const statusPlugin = getYadetoStatusPlugin();
  if (!statusPlugin?.scheduleAlarm) return;

  const now = Date.now();
  const nextIds = new Set<number>();

  if (enabled) {
    for (const item of items) {
      if (!item.date || !item.time) continue;
      if (item.reminder !== undefined && item.reminder < 0) continue;
      const minsBefore = item.reminder ?? 15;
      const [y, m, d] = toLatinDigits(item.date.slice(0, 10)).split('-').map(Number);
      const [hh, mm] = toLatinDigits(item.time).split(':').map(Number);
      if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) continue;

      const triggerMs = new Date(y, m - 1, d, hh, mm, 0).getTime() - minsBefore * 60 * 1000;
      if (triggerMs <= now) continue;

      const alarmId = numericId(`${item.kind}:${item.id}`);
      nextIds.add(alarmId);

      const title = item.kind === 'event' ? `رویداد: ${item.title}` : `کار: ${item.title}`;
      const body =
        minsBefore > 0
          ? `${minsBefore} دقیقه تا «${item.title}» باقی مانده (ساعت ${item.time})`
          : `زمان «${item.title}» فرا رسید (ساعت ${item.time})`;

      try {
        await statusPlugin.scheduleAlarm({
          alarmId,
          title,
          body,
          triggerAtMs: triggerMs,
          soundId: getSavedAlarmSound(),
          vibrate: getAlarmVibrationEnabled(),
          itemId: item.id,
          kind: item.kind,
        });
      } catch {
        // ignore individual schedule errors
      }
    }
  }

  // Cancel any previously synced alarms that were removed, completed, or disabled
  if (statusPlugin.cancelAlarm) {
    for (const oldId of syncedNativeAlarmIds) {
      if (!nextIds.has(oldId)) {
        try {
          await statusPlugin.cancelAlarm({ alarmId: oldId });
        } catch {
          // ignore
        }
      }
    }
  }
  syncedNativeAlarmIds.clear();
  for (const id of nextIds) syncedNativeAlarmIds.add(id);
}
