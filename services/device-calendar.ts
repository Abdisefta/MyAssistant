import { Linking, Platform } from 'react-native';

type ExpoCalendarModule = typeof import('expo-calendar');

export type CalendarEventItem = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  calendarName: string;
  calendarColor?: string;
  allDay: boolean;
  notes?: string;
};

export type CalendarAccessState =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unavailable';

let calendarModule: ExpoCalendarModule | null = null;
let calendarUnavailable = false;

async function getCalendarModule(): Promise<ExpoCalendarModule | null> {
  if (calendarUnavailable) return null;

  if (!calendarModule) {
    try {
      const mod = await import('expo-calendar');
      await mod.getCalendarPermissionsAsync();
      calendarModule = mod;
    } catch {
      calendarUnavailable = true;
      return null;
    }
  }

  return calendarModule;
}

export async function getCalendarAccessState(): Promise<CalendarAccessState> {
  const Calendar = await getCalendarModule();
  if (!Calendar) return 'unavailable';

  const { status } = await Calendar.getCalendarPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function requestCalendarAccess(): Promise<boolean> {
  const Calendar = await getCalendarModule();
  if (!Calendar) return false;

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

export function openAppSettings(): void {
  Linking.openSettings();
}

function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export async function listConnectedCalendars(): Promise<
  Array<{ id: string; title: string; color?: string; sourceName?: string }>
> {
  const Calendar = await getCalendarModule();
  if (!Calendar) return [];

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars.map((cal) => ({
    id: cal.id,
    title: cal.title,
    color: cal.color,
    sourceName: cal.source?.name,
  }));
}

export async function fetchEventsForDay(date: Date): Promise<CalendarEventItem[]> {
  const access = await getCalendarAccessState();
  if (access !== 'granted') return [];

  const Calendar = await getCalendarModule();
  if (!Calendar) return [];

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (!calendars.length) return [];

  const calendarMap = new Map(calendars.map((cal) => [cal.id, cal]));
  const { start, end } = dayRange(date);

  const events = await Calendar.getEventsAsync(
    calendars.map((cal) => cal.id),
    start,
    end,
  );

  return events
    .map((event) => {
      const cal = calendarMap.get(event.calendarId);
      return {
        id: event.id,
        title: event.title?.trim() || 'Möte',
        start: toDate(event.startDate),
        end: toDate(event.endDate),
        location: event.location?.trim() || undefined,
        calendarName: cal?.title ?? 'Kalender',
        calendarColor: cal?.color,
        allDay: Boolean(event.allDay),
        notes: event.notes?.trim() || undefined,
      };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function countEventsForDay(date: Date): Promise<number | null> {
  try {
    const access = await getCalendarAccessState();
    if (access !== 'granted') return null;
    const events = await fetchEventsForDay(date);
    return events.length;
  } catch {
    return null;
  }
}

export function formatEventTime(event: CalendarEventItem): string {
  if (event.allDay) return 'Hela dagen';

  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const start = event.start.toLocaleTimeString('sv-SE', opts);
  const end = event.end.toLocaleTimeString('sv-SE', opts);
  return `${start} – ${end}`;
}

export function formatDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return 'Idag';

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target.getTime() === tomorrow.getTime()) return 'Imorgon';

  return date.toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function getPlatformCalendarHint(): string {
  if (Platform.OS === 'ios') {
    return 'Visar kalendrar från iPhone (Apple, Google, Outlook m.m.)';
  }
  return 'Visar kalendrar från telefonen (Google, Samsung, Outlook m.m.)';
}

export function getNativeRebuildCommand(): string {
  return Platform.OS === 'ios' ? 'npx expo run:ios' : 'npx expo run:android';
}
