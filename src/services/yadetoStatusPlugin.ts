import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from '@/lib/capacitor';

export interface YadetoAlarmPermissions {
  notifications: boolean;
  exactAlarm: boolean;
  batteryIgnored: boolean;
  fullScreenIntent: boolean;
  allGranted: boolean;
}

export interface YadetoStatusPluginApi {
  updateStatus: (opts: {
    dateLabel: string;
    summaryLine: string;
    detailsText: string;
    stickyEnabled: boolean;
  }) => Promise<void>;
  saveAlarmPrefs: (opts: { soundId: string; vibrate: boolean }) => Promise<void>;
  scheduleAlarm: (opts: {
    alarmId: number;
    title: string;
    body: string;
    triggerAtMs: number;
    soundId: string;
    vibrate: boolean;
    itemId?: string;
    kind?: string;
  }) => Promise<void>;
  cancelAlarm: (opts: { alarmId: number }) => Promise<void>;
  stopActiveAlarm: () => Promise<void>;
  consumeCompletedTasks: () => Promise<{ ids?: string[] }>;
  checkAlarmPermissions: () => Promise<YadetoAlarmPermissions>;
  requestAlarmPermission: (opts: { type: string }) => Promise<void>;
}

let cachedPlugin: YadetoStatusPluginApi | null = null;

/**
 * Returns a plain-object wrapper around Capacitor's YadetoStatus native plugin
 * (registered via registerPlugin so it works in Capacitor 8 without relying on
 * window.Capacitor.Plugins and without exposing a raw Proxy thenable).
 */
export function getYadetoStatusPlugin(): YadetoStatusPluginApi | null {
  if (!isNativeApp()) return null;
  if (cachedPlugin) return cachedPlugin;

  try {
    const raw = registerPlugin<YadetoStatusPluginApi>('YadetoStatus');
    cachedPlugin = {
      updateStatus: (opts) => raw.updateStatus(opts),
      saveAlarmPrefs: (opts) => raw.saveAlarmPrefs(opts),
      scheduleAlarm: (opts) => raw.scheduleAlarm(opts),
      cancelAlarm: (opts) => raw.cancelAlarm(opts),
      stopActiveAlarm: () => raw.stopActiveAlarm(),
      consumeCompletedTasks: () => raw.consumeCompletedTasks(),
      checkAlarmPermissions: () => raw.checkAlarmPermissions(),
      requestAlarmPermission: (opts) => raw.requestAlarmPermission(opts),
    };
    return cachedPlugin;
  } catch {
    return null;
  }
}
