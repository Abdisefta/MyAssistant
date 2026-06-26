import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getActiveLocale } from '@/constants/i18n';
import { getTranslations } from '@/constants/i18n/translations/index';
import { ensureNotificationPermissions } from '@/services/meeting-reminders';
import {
  ensureNotificationChannels,
  getNotificationContentOptions,
} from '@/services/notification-settings';
import * as Notifications from '@/services/notifications';
import type { AgentTask } from '@/types/memory';

const TASK_REMINDER_IDS_KEY = '@my_assistant_task_reminder_ids';

async function loadTaskReminderIds(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(TASK_REMINDER_IDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveTaskReminderIds(map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(TASK_REMINDER_IDS_KEY, JSON.stringify(map));
}

export async function scheduleTaskReminder(
  task: AgentTask,
  alertStyle: 'sound' | 'vibration' | 'silent' = 'sound',
): Promise<boolean> {
  if (!task.remindAt || task.remindAt <= Date.now()) return false;

  const hasPermission = await ensureNotificationPermissions(alertStyle);
  if (!hasPermission) return false;

  const { tasksChannelId } = await ensureNotificationChannels(alertStyle);
  const { sound } = getNotificationContentOptions(alertStyle);

  const ids = await loadTaskReminderIds();
  if (ids[task.id]) {
    await Notifications.cancelScheduledNotificationAsync(ids[task.id]);
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    identifier: `task-${task.id}`,
    content: {
      title: getTranslations(getActiveLocale()).notifications.taskTitle,
      body: task.text,
      sound,
      data: { type: 'task', taskId: task.id },
      ...(Platform.OS === 'android' ? { channelId: tasksChannelId } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(task.remindAt),
    },
  });

  ids[task.id] = notificationId;
  await saveTaskReminderIds(ids);
  return true;
}

export async function cancelTaskReminder(taskId: string): Promise<void> {
  const ids = await loadTaskReminderIds();
  const notificationId = ids[taskId];
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    delete ids[taskId];
    await saveTaskReminderIds(ids);
  }
}
