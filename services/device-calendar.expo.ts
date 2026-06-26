import { Linking, Platform } from 'react-native';

import { getActiveLocale } from '@/constants/i18n';
import { getTranslations } from '@/constants/i18n/translations/index';
import {
  addLocalCalendarEvent,
  countLocalEventsForDay,
  listLocalEventsForDay,
  removeLocalCalendarEventById,
  removeLocalEventsMatching,
  type StoredCalendarEvent,
} from '@/services/local-calendar-store';
import {
  formatAllDay,
  formatDayLabel as formatDayLabelLocale,
  formatEventTimeRange,
  getFormatTag,
} from '@/utils/locale-format';

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

function toEventItem(event: StoredCalendarEvent): CalendarEventItem {
  return {
    id: event.id,
    title: event.title,
    start: new Date(event.start),
    end: new Date(event.end),
    location: event.location,
    calendarName: event.calendarName,
    calendarColor: '#8B7CF7',
    allDay: event.allDay,
    notes: event.notes,
  };
}

/** Expo Go: sparar möten i appen kopplat till inloggat konto. */
export async function getCalendarAccessState(): Promise<CalendarAccessState> {
  return 'granted';
}

export async function requestCalendarAccess(): Promise<boolean> {
  return true;
}

export function openAppSettings(): void {
  Linking.openSettings();
}

export async function listConnectedCalendars(): Promise<
  Array<{
    id: string;
    title: string;
    color?: string;
    sourceName?: string;
    allowsModifications?: boolean;
  }>
> {
  return [{ id: 'local', title: 'Google Kalender (Expo Go)', allowsModifications: true }];
}

export async function fetchLocalEventsForDay(
  date: Date,
  userId?: string,
): Promise<CalendarEventItem[]> {
  return (await listLocalEventsForDay(date, userId)).map(toEventItem);
}

export async function fetchEventsForDay(date: Date, userId?: string): Promise<CalendarEventItem[]> {
  const events = await listLocalEventsForDay(date, userId);
  return events.map(toEventItem);
}

export async function countEventsForDay(date: Date, userId?: string): Promise<number | null> {
  return countLocalEventsForDay(date, userId);
}

export async function createCalendarEvent(
  params: {
    title: string;
    start: Date;
    end: Date;
    notes?: string;
  },
  userId?: string,
): Promise<
  | { ok: true; mode: 'silent' }
  | { ok: true; mode: 'native_dialog' }
  | { ok: false; error: string }
> {
  try {
    await addLocalCalendarEvent(params, userId);
    return { ok: true, mode: 'silent' };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Kunde inte spara mötet: ${detail}` };
  }
}

export async function deleteCalendarEvent(
  eventId: string,
  userId?: string,
): Promise<boolean> {
  return removeLocalCalendarEventById(eventId, userId);
}

export async function cancelCalendarEventsMatching(
  params: {
    day: Date;
    windowStart?: Date;
    windowEnd?: Date;
    titleHint?: string;
  },
  userId?: string,
): Promise<{ removed: number; remaining: number }> {
  const { day, windowStart, windowEnd, titleHint } = params;
  let removed = 0;

  for (let pass = 0; pass < 3; pass++) {
    const events = (await listLocalEventsForDay(day, userId)).map(toEventItem);
    const targets = events.filter((event) => {
      if (windowStart && windowEnd) {
        const inWindow =
          event.end.getTime() > windowStart.getTime() &&
          event.start.getTime() < windowEnd.getTime();
        if (!inWindow) return false;
      }
      if (titleHint) {
        return event.title.toLowerCase().includes(titleHint.toLowerCase());
      }
      return true;
    });
    if (targets.length === 0) break;
    for (const event of targets) {
      if (await removeLocalCalendarEventById(event.id, userId)) removed += 1;
    }
    if (windowStart && windowEnd) {
      removed += await removeLocalEventsMatching(
        day,
        { start: windowStart, end: windowEnd },
        userId,
      );
    }
  }

  const remainingEvents = (await listLocalEventsForDay(day, userId)).filter((event) => {
    const item = toEventItem(event);
    if (windowStart && windowEnd) {
      const inWindow =
        item.end.getTime() > windowStart.getTime() &&
        item.start.getTime() < windowEnd.getTime();
      if (!inWindow) return false;
    }
    if (titleHint) return item.title.toLowerCase().includes(titleHint.toLowerCase());
    return true;
  });

  return { removed, remaining: remainingEvents.length };
}

export async function deleteCalendarEventCompletely(
  event: CalendarEventItem,
  userId?: string,
): Promise<{ ok: boolean; remaining: number }> {
  const titleHint =
    event.title.length > 2 && !/^möte$/i.test(event.title) ? event.title : undefined;
  const result = await cancelCalendarEventsMatching(
    {
      day: event.start,
      windowStart: event.start,
      windowEnd: event.end,
      titleHint,
    },
    userId,
  );
  return { ok: result.remaining === 0, remaining: result.remaining };
}

export async function cancelAllEventsForDay(
  day: Date,
  userId?: string,
): Promise<{ removed: number; remaining: number }> {
  let removed = 0;

  for (let pass = 0; pass < 4; pass++) {
    const events = (await listLocalEventsForDay(day, userId)).map(toEventItem);
    if (events.length === 0) break;

    for (const event of events) {
      const before = (await listLocalEventsForDay(day, userId)).length;
      await deleteCalendarEventCompletely(event, userId);
      const after = (await listLocalEventsForDay(day, userId)).length;
      if (after < before) removed += before - after;
    }
  }

  const remaining = (await listLocalEventsForDay(day, userId)).length;
  return { removed, remaining };
}

export async function deleteCalendarEvents(
  events: CalendarEventItem[],
  userId?: string,
): Promise<number> {
  let count = 0;
  for (const event of events) {
    const ok = await deleteCalendarEvent(event.id, userId);
    if (ok) count += 1;
  }
  return count;
}

export function formatBookingSummary(title: string, start: Date, end: Date): string {
  const tag = getFormatTag();
  const day = start.toLocaleDateString(tag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const t1 = start.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
  const t2 = end.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
  return `${title}, ${day} ${t1}–${t2}`;
}

export function formatEventTime(event: CalendarEventItem): string {
  if (event.allDay) return formatAllDay();
  return formatEventTimeRange(event.start, event.end);
}

export function formatDayLabel(date: Date): string {
  return formatDayLabelLocale(date);
}

export function getPlatformCalendarHint(): string {
  return getTranslations(getActiveLocale()).calendar.platformHint;
}

export function getEmptyDayMessage(): string {
  return getTranslations(getActiveLocale()).calendar.emptyDay;
}

export function getNativeRebuildCommand(): string {
  return Platform.OS === 'ios' ? 'npx expo run:ios' : 'npx expo run:android';
}
