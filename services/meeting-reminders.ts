import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  fetchEventsForDay,
  formatEventTime,
  getCalendarAccessState,
  type CalendarEventItem,
} from '@/services/device-calendar';
import type { UserMemory } from '@/types/memory';

const REMINDER_IDS_KEY = '@my_assistant_meeting_reminder_ids';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function loadReminderIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveReminderIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(ids));
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meetings', {
      name: 'Möten',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function cancelStoredReminders(): Promise<void> {
  const ids = await loadReminderIds();
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
  await saveReminderIds([]);
}

function reminderIdForEvent(event: CalendarEventItem): string {
  return `meeting-${event.id}-${event.start.getTime()}`;
}

export async function syncMeetingReminders(memory: UserMemory): Promise<number> {
  if (!memory.meetingRemindersEnabled) {
    await cancelStoredReminders();
    return 0;
  }

  const access = await getCalendarAccessState();
  if (access !== 'granted') return 0;

  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) return 0;

  await cancelStoredReminders();

  const minutesBefore = memory.reminderMinutesBefore ?? 15;
  const now = Date.now();
  const today = new Date();
  const events: CalendarEventItem[] = [];

  for (let i = 0; i < 7; i++) {
    events.push(...(await fetchEventsForDay(addDays(today, i))));
  }

  const scheduledIds: string[] = [];

  for (const event of events) {
    if (event.allDay) continue;

    const reminderAt = event.start.getTime() - minutesBefore * 60 * 1000;
    if (reminderAt <= now) continue;

    const identifier = reminderIdForEvent(event);
    const timeLabel = formatEventTime(event);

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: 'Möte snart',
        body: `${event.title} börjar om ${minutesBefore} min (${timeLabel})`,
        sound: true,
        data: {
          type: 'meeting',
          eventId: event.id,
          title: event.title,
          location: event.location ?? '',
        },
        ...(Platform.OS === 'android' ? { channelId: 'meetings' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminderAt),
      },
    });

    scheduledIds.push(identifier);
  }

  await saveReminderIds(scheduledIds);
  return scheduledIds.length;
}
