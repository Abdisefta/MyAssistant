import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getActiveLocale } from '@/constants/i18n';
import { ensureNotificationPermissions } from '@/services/meeting-reminders';
import {
  ensureNotificationChannels,
  getNotificationContentOptions,
} from '@/services/notification-settings';
import * as Notifications from '@/services/notifications';
import type { BirthdayEntry, UserMemory } from '@/types/memory';

const BIRTHDAY_REMINDER_IDS_KEY = '@my_assistant_birthday_reminder_ids';

function nextBirthdayOccurrence(entry: BirthdayEntry, from = new Date()): Date {
  const year = from.getFullYear();
  let candidate = new Date(year, entry.month - 1, entry.day, 9, 0, 0, 0);
  if (candidate.getTime() <= from.getTime()) {
    candidate = new Date(year + 1, entry.month - 1, entry.day, 9, 0, 0, 0);
  }
  return candidate;
}

/** Remind at 09:00 the day before the birthday. */
function reminderDateForBirthday(birthday: Date): Date {
  const remind = new Date(birthday);
  remind.setDate(remind.getDate() - 1);
  remind.setHours(9, 0, 0, 0);
  return remind;
}

async function loadReminderIds(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(BIRTHDAY_REMINDER_IDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveReminderIds(map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(BIRTHDAY_REMINDER_IDS_KEY, JSON.stringify(map));
}

export async function syncBirthdayReminders(
  memory: UserMemory,
  alertStyle: 'sound' | 'vibration' | 'silent' = 'sound',
): Promise<void> {
  const birthdays = memory.birthdays ?? [];
  const ids = await loadReminderIds();
  const activeIds = new Set<string>();

  for (const entry of birthdays) {
    const birthday = nextBirthdayOccurrence(entry);
    const remindAt = reminderDateForBirthday(birthday);
    if (remindAt.getTime() <= Date.now()) continue;

    const hasPermission = await ensureNotificationPermissions(alertStyle);
    if (!hasPermission) continue;

    const { tasksChannelId } = await ensureNotificationChannels(alertStyle);
    const { sound } = getNotificationContentOptions(alertStyle);

    if (ids[entry.id]) {
      await Notifications.cancelScheduledNotificationAsync(ids[entry.id]);
    }

    const dayLabel = birthday.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });
    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: `birthday-${entry.id}`,
      content: {
        title: '🎂 Födelsedag imorgon',
        body: `${entry.name} fyller år ${dayLabel}.`,
        sound,
        data: { type: 'birthday', birthdayId: entry.id },
        ...(Platform.OS === 'android' ? { channelId: tasksChannelId } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: remindAt,
      },
    });

    ids[entry.id] = notificationId;
    activeIds.add(entry.id);
  }

  for (const [entryId, notificationId] of Object.entries(ids)) {
    if (!activeIds.has(entryId)) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      delete ids[entryId];
    }
  }

  await saveReminderIds(ids);
}

export function getUpcomingBirthdays(
  memory: UserMemory,
  withinDays = 14,
): { entry: BirthdayEntry; daysUntil: number; date: Date }[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const results: { entry: BirthdayEntry; daysUntil: number; date: Date }[] = [];

  for (const entry of memory.birthdays ?? []) {
    const next = nextBirthdayOccurrence(entry, now);
    const diffMs = next.getTime() - now.getTime();
    const daysUntil = Math.round(diffMs / (24 * 60 * 60 * 1000));
    if (daysUntil >= 0 && daysUntil <= withinDays) {
      results.push({ entry, daysUntil, date: next });
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function createBirthdayEntry(name: string, month: number, day: number): BirthdayEntry {
  return {
    id: `bday-${Date.now()}`,
    name: name.trim(),
    month,
    day,
    createdAt: Date.now(),
  };
}

export function formatBirthdayLabel(entry: BirthdayEntry): string {
  const d = new Date(2000, entry.month - 1, entry.day);
  return `${entry.name} — ${d.toLocaleDateString(getActiveLocale() === 'sv' ? 'sv-SE' : 'en-GB', {
    day: 'numeric',
    month: 'long',
  })}`;
}
