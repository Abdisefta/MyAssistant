import type { CalendarEventItem } from '@/services/device-calendar';

export type SwedishHoliday = {
  id: string;
  name: string;
  date: Date;
  isRedDay: boolean;
};

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function midsummerDay(year: number): Date {
  for (let day = 20; day <= 26; day += 1) {
    const candidate = new Date(year, 5, day);
    if (candidate.getDay() === 6) return candidate;
  }
  return new Date(year, 5, 26);
}

function allSaintsDay(year: number): Date {
  for (let day = 31; day <= 37; day += 1) {
    const candidate = new Date(year, 9, day);
    if (candidate.getDay() === 6) return candidate;
  }
  return new Date(year, 10, 6);
}

function fixedHoliday(year: number, month: number, day: number, name: string): SwedishHoliday {
  return {
    id: `se-${year}-${month}-${day}`,
    name,
    date: new Date(year, month - 1, day),
    isRedDay: true,
  };
}

export function getSwedishHolidaysForYear(year: number): SwedishHoliday[] {
  const easter = easterSunday(year);
  const midsummer = midsummerDay(year);
  return [
    fixedHoliday(year, 1, 1, 'Nyårsdagen'),
    fixedHoliday(year, 1, 6, 'Trettondedag jul'),
    { id: `se-${year}-good-friday`, name: 'Långfredagen', date: addDays(easter, -2), isRedDay: true },
    { id: `se-${year}-easter`, name: 'Påskdagen', date: easter, isRedDay: true },
    { id: `se-${year}-easter-mon`, name: 'Annandag påsk', date: addDays(easter, 1), isRedDay: true },
    fixedHoliday(year, 5, 1, 'Första maj'),
    { id: `se-${year}-ascension`, name: 'Kristi himmelsfärds dag', date: addDays(easter, 39), isRedDay: true },
    { id: `se-${year}-whit`, name: 'Pingstdagen', date: addDays(easter, 49), isRedDay: true },
    fixedHoliday(year, 6, 6, 'Sveriges nationaldag'),
    { id: `se-${year}-midsummer-eve`, name: 'Midsommarafton', date: addDays(midsummer, -1), isRedDay: false },
    { id: `se-${year}-midsummer`, name: 'Midsommardagen', date: midsummer, isRedDay: true },
    { id: `se-${year}-all-saints`, name: 'Alla helgons dag', date: allSaintsDay(year), isRedDay: true },
    fixedHoliday(year, 12, 24, 'Julafton'),
    fixedHoliday(year, 12, 25, 'Juldagen'),
    fixedHoliday(year, 12, 26, 'Annandag jul'),
    fixedHoliday(year, 12, 31, 'Nyårsafton'),
  ];
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getSwedishHolidayForDate(date: Date): SwedishHoliday | null {
  const year = date.getFullYear();
  const holidays = [
    ...getSwedishHolidaysForYear(year - 1),
    ...getSwedishHolidaysForYear(year),
    ...getSwedishHolidaysForYear(year + 1),
  ];
  return holidays.find((h) => isSameDay(h.date, date)) ?? null;
}

export function holidayToCalendarEvent(holiday: SwedishHoliday): CalendarEventItem {
  const start = new Date(holiday.date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(holiday.date);
  end.setHours(23, 59, 59, 999);
  return {
    id: `holiday-${holiday.id}`,
    title: holiday.isRedDay ? `🔴 ${holiday.name}` : holiday.name,
    start,
    end,
    allDay: true,
    calendarName: 'Helgdagar',
    location: 'Sverige',
    notes: holiday.isRedDay ? 'Röd dag' : 'Helgdag',
    calendarColor: '#E53935',
  };
}

export function mergeHolidayEvents(
  date: Date,
  events: CalendarEventItem[],
): CalendarEventItem[] {
  const holiday = getSwedishHolidayForDate(date);
  if (!holiday) return events;
  const synthetic = holidayToCalendarEvent(holiday);
  if (events.some((e) => e.id === synthetic.id || e.title.includes(holiday.name))) {
    return events;
  }
  return [synthetic, ...events];
}
