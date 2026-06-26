import * as Calendar from 'expo-calendar';
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

function nativeToItem(event: Calendar.Event): CalendarEventItem {
  return {
    id: event.id,
    title: event.title ?? 'Möte',
    start: new Date(event.startDate),
    end: new Date(event.endDate),
    location: event.location ?? undefined,
    calendarName: event.calendarId ?? 'Telefonkalender',
    calendarColor: '#8B7CF7',
    allDay: Boolean(event.allDay),
    notes: event.notes ?? undefined,
  };
}

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function hasNativeCalendarAccess(): Promise<boolean> {
  try {
    const perm = await Calendar.getCalendarPermissionsAsync();
    return perm.granted;
  } catch {
    return false;
  }
}

/** Installerad app / dev build: sparar i telefonkalender + lokalt backup. */
export async function getCalendarAccessState(): Promise<CalendarAccessState> {
  try {
    const perm = await Calendar.getCalendarPermissionsAsync();
    if (perm.granted) return 'granted';
    if (perm.status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'granted';
  }
}

export async function requestCalendarAccess(): Promise<boolean> {
  try {
    const perm = await Calendar.requestCalendarPermissionsAsync();
    return perm.granted;
  } catch {
    return true;
  }
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
  try {
    if (!(await hasNativeCalendarAccess())) {
      return [{ id: 'local', title: 'Min kalender (i appen)', allowsModifications: true }];
    }
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendars.length === 0) {
      return [{ id: 'local', title: 'Min kalender (i appen)', allowsModifications: true }];
    }
    return calendars.map((cal) => ({
      id: cal.id,
      title: cal.title ?? 'Kalender',
      color: cal.color ?? undefined,
      sourceName: cal.source?.name,
      allowsModifications: cal.allowsModifications,
    }));
  } catch {
    return [{ id: 'local', title: 'Min kalender (i appen)', allowsModifications: true }];
  }
}

function dedupeEvents(events: CalendarEventItem[]): CalendarEventItem[] {
  const seen = new Map<string, CalendarEventItem>();
  for (const event of events) {
    const key = `${event.title.toLowerCase().trim()}|${event.start.getTime()}|${event.end.getTime()}`;
    const existing = seen.get(key);
    if (!existing || event.id.startsWith('local-')) {
      seen.set(key, event);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function fetchLocalEventsForDay(
  date: Date,
  userId?: string,
): Promise<CalendarEventItem[]> {
  return (await listLocalEventsForDay(date, userId)).map(toEventItem);
}

export async function fetchEventsForDay(date: Date, userId?: string): Promise<CalendarEventItem[]> {
  const local = (await listLocalEventsForDay(date, userId)).map(toEventItem);
  const merged = new Map<string, CalendarEventItem>();
  for (const event of local) {
    merged.set(event.id, event);
  }

  try {
    if (await hasNativeCalendarAccess()) {
      const { start, end } = dayBounds(date);
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      for (const cal of calendars) {
        const nativeEvents = await Calendar.getEventsAsync([cal.id], start, end);
        for (const event of nativeEvents) {
          merged.set(event.id, nativeToItem(event));
        }
      }
    }
  } catch {
    // lokala möten räcker
  }

  return dedupeEvents(Array.from(merged.values()));
}

export async function countEventsForDay(date: Date, userId?: string): Promise<number | null> {
  return (await fetchEventsForDay(date, userId)).length;
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: detail };
  }

  // Spara bara lokalt — annars blir varje möte dubbelt (app + telefonkalender).
  return { ok: true, mode: 'silent' };
}

export async function deleteCalendarEvent(
  eventId: string,
  userId?: string,
): Promise<boolean> {
  if (eventId.startsWith('local-')) {
    return removeLocalCalendarEventById(eventId, userId);
  }

  try {
    if (await hasNativeCalendarAccess()) {
      await Calendar.deleteEventAsync(eventId);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function eventInWindow(
  event: CalendarEventItem,
  windowStart?: Date,
  windowEnd?: Date,
): boolean {
  if (!windowStart) return true;
  const rangeEnd = windowEnd ?? new Date(windowStart.getTime() + 60 * 60 * 1000);
  return event.end.getTime() > windowStart.getTime() && event.start.getTime() < rangeEnd.getTime();
}

function eventMatchesTitle(event: CalendarEventItem, titleHint?: string): boolean {
  if (!titleHint) return true;
  return event.title.toLowerCase().includes(titleHint.toLowerCase());
}

/** Tar bort alla kopior — både i appen och i telefonens kalender. */
export async function cancelCalendarEventsMatching(
  params: {
    day: Date;
    windowStart?: Date;
    windowEnd?: Date;
    titleHint?: string;
    exactEvent?: { start: Date; end: Date; title?: string };
  },
  userId?: string,
): Promise<{ removed: number; remaining: number }> {
  const { day, windowStart, windowEnd, titleHint, exactEvent } = params;
  let removed = 0;

  const isMatch = (event: CalendarEventItem) => {
    if (exactEvent) {
      const sameStart = Math.abs(event.start.getTime() - exactEvent.start.getTime()) < 60_000;
      const sameEnd = Math.abs(event.end.getTime() - exactEvent.end.getTime()) < 60_000;
      if (!sameStart || !sameEnd) return false;
      if (exactEvent.title && !eventMatchesTitle(event, exactEvent.title)) return false;
      return true;
    }
    return eventInWindow(event, windowStart, windowEnd) && eventMatchesTitle(event, titleHint);
  };

  for (let pass = 0; pass < 4; pass++) {
    const events = await fetchEventsForDay(day, userId);
    const targets = events.filter(isMatch);
    if (targets.length === 0) break;

    for (const event of targets) {
      if (event.id.startsWith('local-')) {
        if (await removeLocalCalendarEventById(event.id, userId)) removed += 1;
      } else {
        try {
          if (await hasNativeCalendarAccess()) {
            await Calendar.deleteEventAsync(event.id);
            removed += 1;
          }
        } catch {
          // native delete can fail on read-only calendars
        }
      }
    }

    if (exactEvent) {
      removed += await removeLocalEventsMatching(
        day,
        {
          start: exactEvent.start,
          end: exactEvent.end,
          titleHint: exactEvent.title,
        },
        userId,
      );
    } else if (windowStart && windowEnd) {
      // Lokala kopior har ofta titeln "Möte" — ta bort allt i tidsfönstret
      removed += await removeLocalEventsMatching(
        day,
        { start: windowStart, end: windowEnd },
        userId,
      );
    } else if (titleHint) {
      removed += await removeLocalEventsMatching(day, { titleHint }, userId);
    }
  }

  const remaining = (await fetchEventsForDay(day, userId)).filter(isMatch).length;
  return { removed, remaining };
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

/** Tar bort alla möten en dag — både i appen och telefonkalendern. */
export async function cancelAllEventsForDay(
  day: Date,
  userId?: string,
): Promise<{ removed: number; remaining: number }> {
  let removed = 0;

  for (let pass = 0; pass < 4; pass++) {
    const events = await fetchEventsForDay(day, userId);
    if (events.length === 0) break;

    for (const event of events) {
      const before = (await fetchEventsForDay(day, userId)).length;
      await deleteCalendarEventCompletely(event, userId);
      const after = (await fetchEventsForDay(day, userId)).length;
      if (after < before) removed += before - after;
    }
  }

  const remaining = (await fetchEventsForDay(day, userId)).length;
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
