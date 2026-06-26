import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@my_assistant_local_calendar_events';
const LEGACY_STORAGE_KEY = '@my_assistant_local_calendar_events';

export type StoredCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  notes?: string;
  calendarName: string;
  allDay: boolean;
};

let activeUserId: string | null = null;

export function setLocalCalendarUserId(userId: string | null): void {
  activeUserId = userId;
}

export function getLocalCalendarUserId(): string | null {
  return activeUserId;
}

function resolveUserId(userId?: string): string | null {
  return userId ?? activeUserId;
}

function storageKey(userId?: string): string | null {
  const uid = resolveUserId(userId);
  if (!uid) return null;
  return `${STORAGE_PREFIX}_${uid}`;
}

export async function migrateLegacyCalendarEvents(userId: string): Promise<void> {
  const userKey = `${STORAGE_PREFIX}_${userId}`;

  try {
    const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return;

    const legacyEvents = JSON.parse(legacyRaw) as StoredCalendarEvent[];
    if (!Array.isArray(legacyEvents) || legacyEvents.length === 0) {
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      return;
    }

    const userRaw = await AsyncStorage.getItem(userKey);
    const userEvents: StoredCalendarEvent[] = userRaw
      ? (JSON.parse(userRaw) as StoredCalendarEvent[])
      : [];

    const merged = [...userEvents];
    for (const event of legacyEvents) {
      if (!merged.some((existing) => existing.id === event.id)) {
        merged.push(event);
      }
    }

    await AsyncStorage.setItem(userKey, JSON.stringify(merged));
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore migration errors
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

async function loadAll(userId?: string): Promise<StoredCalendarEvent[]> {
  const key = storageKey(userId);
  if (!key) return [];

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCalendarEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(events: StoredCalendarEvent[], userId?: string): Promise<void> {
  const key = storageKey(userId);
  if (!key) {
    throw new Error('Du måste vara inloggad för att spara möten.');
  }
  await AsyncStorage.setItem(key, JSON.stringify(events));
}

export async function listLocalEventsForDay(date: Date, userId?: string): Promise<StoredCalendarEvent[]> {
  const all = await loadAll(userId);
  return all
    .filter((event) => isSameDay(new Date(event.start), date))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export async function countLocalEventsForDay(date: Date, userId?: string): Promise<number> {
  return (await listLocalEventsForDay(date, userId)).length;
}

export async function addLocalCalendarEvent(
  params: {
    title: string;
    start: Date;
    end: Date;
    notes?: string;
    location?: string;
  },
  userId?: string,
): Promise<StoredCalendarEvent> {
  const uid = resolveUserId(userId);
  if (!uid) {
    throw new Error('Du måste vara inloggad för att boka möten.');
  }

  const event: StoredCalendarEvent = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: params.title,
    start: params.start.toISOString(),
    end: params.end.toISOString(),
    notes: params.notes,
    location: params.location,
    calendarName: 'Min kalender',
    allDay: false,
  };

  const all = await loadAll(uid);
  all.push(event);
  await saveAll(all, uid);
  return event;
}

export async function removeLocalCalendarEventById(
  eventId: string,
  userId?: string,
): Promise<boolean> {
  const uid = resolveUserId(userId);
  if (!uid) return false;

  const all = await loadAll(uid);
  const next = all.filter((event) => event.id !== eventId);
  if (next.length === all.length) return false;

  await saveAll(next, uid);
  return true;
}

function localEventMatchesSlot(
  event: StoredCalendarEvent,
  start: Date,
  end: Date,
  titleHint?: string,
): boolean {
  const eventStart = new Date(event.start).getTime();
  const eventEnd = new Date(event.end).getTime();
  const sameSlot =
    Math.abs(eventStart - start.getTime()) < 90_000 &&
    Math.abs(eventEnd - end.getTime()) < 90_000;
  if (!sameSlot) return false;
  if (!titleHint) return true;
  return event.title.toLowerCase().includes(titleHint.toLowerCase());
}

export async function removeLocalEventsMatching(
  day: Date,
  params: { start?: Date; end?: Date; titleHint?: string },
  userId?: string,
): Promise<number> {
  const uid = resolveUserId(userId);
  if (!uid) return 0;

  const all = await loadAll(uid);
  let removed = 0;
  const next = all.filter((event) => {
    if (!isSameDay(new Date(event.start), day)) return true;

    let matches = false;
    if (params.start && params.end) {
      matches = localEventMatchesSlot(event, params.start, params.end, params.titleHint);
    } else if (params.titleHint) {
      matches = event.title.toLowerCase().includes(params.titleHint.toLowerCase());
    }

    if (matches) {
      removed += 1;
      return false;
    }
    return true;
  });

  if (removed > 0) {
    await saveAll(next, uid);
  }
  return removed;
}
