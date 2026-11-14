/**
 * Local cache helpers for the Smart Calendar module — built on the app's
 * safeStorage wrapper (memory fallback for Android WebViews).
 */
import { getItem, setItem, removeItem } from '@/lib/safeStorage';

const PREFIX = 'cal:';

export function localSet<T>(key: string, value: T): void {
  try {
    setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('[SmartCalendar] localSet failed', key, e);
  }
}

export function localGet<T>(key: string): T | null {
  try {
    const raw = getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.warn('[SmartCalendar] localGet failed', key, e);
    return null;
  }
}

export function localRemove(key: string): void {
  try {
    removeItem(PREFIX + key);
  } catch (e) {
    console.warn('[SmartCalendar] localRemove failed', key, e);
  }
}
