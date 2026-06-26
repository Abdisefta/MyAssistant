import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getActiveLocale } from '@/constants/i18n';
import { getTranslations } from '@/constants/i18n/translations/index';
import {
  ensureNotificationChannels,
  getNotificationContentOptions,
} from '@/services/notification-settings';
import {
  fetchEventsForDay,
  formatEventTime,
  type CalendarEventItem,
} from '@/services/device-calendar';
import * as Notifications from '@/services/notifications';
import type { UserMemory } from '@/types/memory';

const REMINDER_IDS_KEY = '@my_assistant_meeting_reminder_ids';

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

export async function ensureNotificationPermissions(
  style: UserMemory['notificationAlertStyle'] = 'sound',
): Promise<boolean> {
  await ensureNotificationChannels(style ?? 'sound');

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

  const alertStyle = memory.notificationAlertStyle ?? 'sound';
  const hasPermission = await ensureNotificationPermissions(alertStyle);
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
  const strings = getTranslations(getActiveLocale());
  const { meetingsChannelId } = await ensureNotificationChannels(alertStyle);
  const { sound } = getNotificationContentOptions(alertStyle);

  for (const event of events) {
    if (event.allDay) continue;

    const reminderAt = event.start.getTime() - minutesBefore * 60 * 1000;
    if (reminderAt <= now) continue;

    const identifier = reminderIdForEvent(event);
    const timeLabel = formatEventTime(event);

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: strings.calendar.meetingSoon,
        body: strings.calendar.meetingBody
          .replace('{{title}}', event.title)
          .replace('{{minutes}}', String(minutesBefore))
          .replace('{{time}}', timeLabel),
        sound,
        data: {
          type: 'meeting',
          eventId: event.id,
          title: event.title,
          location: event.location ?? '',
        },
        ...(Platform.OS === 'android' ? { channelId: meetingsChannelId } : {}),
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
