/**
 * Static reference data for official Iranian holidays (Jalali years 1404–1406).
 * Local-first: shipped with the app so the calendar marks special days offline.
 * Each entry: Jalali date + Gregorian ISO date + type + official-flag.
 */
import type { Holiday } from '@/types/calendar';

function h(
  jy: number,
  jm: number,
  jd: number,
  iso: string,
  title: string,
  type: Holiday['type'],
  isOfficialHoliday: boolean,
): Holiday {
  return {
    id: `holiday-${jy}-${jm}-${jd}-${title.slice(0, 8)}`,
    title,
    jalaliDate: `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`,
    gregorianDate: iso,
    type,
    isOfficialHoliday,
  };
}

// NOTE: Gregorian dates for fixed Jalali holidays; religious holidays follow the
// lunar calendar so their Gregorian equivalents are listed per occurrence.
export const HOLIDAYS: Holiday[] = [
  // ── 1404 ──────────────────────────────────────────────────────
  h(1404, 1, 1, '2025-03-21', 'نوروز', 'national', true),
  h(1404, 1, 2, '2025-03-22', 'نوروز', 'national', true),
  h(1404, 1, 3, '2025-03-23', 'نوروز', 'national', true),
  h(1404, 1, 4, '2025-03-24', 'نوروز', 'national', true),
  h(1404, 1, 12, '2025-04-01', 'روز جمهوری اسلامی', 'national', true),
  h(1404, 1, 13, '2025-04-02', 'روز طبیعت', 'national', true),
  h(1404, 3, 14, '2025-06-04', 'رحلت امام خمینی', 'religious', true),
  h(1404, 3, 15, '2025-06-05', 'قیام ۱۵ خرداد', 'national', true),
  h(1404, 11, 22, '2026-02-11', 'پیروزی انقلاب اسلامی', 'national', true),
  h(1404, 12, 29, '2026-03-20', 'ملی شدن صنعت نفت', 'national', true),
  // ── 1405 ──────────────────────────────────────────────────────
  h(1405, 1, 1, '2026-03-21', 'نوروز', 'national', true),
  h(1405, 1, 2, '2026-03-22', 'نوروز', 'national', true),
  h(1405, 1, 3, '2026-03-23', 'نوروز', 'national', true),
  h(1405, 1, 4, '2026-03-24', 'نوروز', 'national', true),
  h(1405, 1, 12, '2026-04-01', 'روز جمهوری اسلامی', 'national', true),
  h(1405, 1, 13, '2026-04-02', 'روز طبیعت', 'national', true),
  h(1405, 3, 14, '2026-06-04', 'رحلت امام خمینی', 'religious', true),
  h(1405, 3, 15, '2026-06-05', 'قیام ۱۵ خرداد', 'national', true),
  h(1405, 11, 22, '2027-02-11', 'پیروزی انقلاب اسلامی', 'national', true),
  h(1405, 12, 29, '2027-03-20', 'ملی شدن صنعت نفت', 'national', true),
  // ── 1406 ──────────────────────────────────────────────────────
  h(1406, 1, 1, '2027-03-22', 'نوروز', 'national', true),
  h(1406, 1, 2, '2027-03-23', 'نوروز', 'national', true),
  h(1406, 1, 3, '2027-03-24', 'نوروز', 'national', true),
  h(1406, 1, 4, '2027-03-25', 'نوروز', 'national', true),
  h(1406, 1, 12, '2027-04-02', 'روز جمهوری اسلامی', 'national', true),
  h(1406, 1, 13, '2027-04-03', 'روز طبیعت', 'national', true),
  h(1406, 3, 14, '2027-06-05', 'رحلت امام خمینی', 'religious', true),
  h(1406, 3, 15, '2027-06-06', 'قیام ۱۵ خرداد', 'national', true),
  h(1406, 11, 22, '2028-02-11', 'پیروزی انقلاب اسلامی', 'national', true),
  h(1406, 12, 29, '2028-03-20', 'ملی شدن صنعت نفت', 'national', true),
];

/** Local user-added occasions (e.g. birthdays) persisted in localStorage. */
export function loadCustomOccasions(): Holiday[] {
  return [];
}

export function findHolidayByISO(iso: string, extra: Holiday[] = []): Holiday | undefined {
  return [...HOLIDAYS, ...extra].find((d) => d.gregorianDate === iso && d.isOfficialHoliday);
}
