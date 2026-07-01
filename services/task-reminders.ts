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



/** Expo weekly trigger: 1=Sunday … 7=Saturday. JS getDay(): 0=Sunday. */

function expoWeekdayFromJs(jsWeekday: number): number {

  return jsWeekday + 1;

}



async function loadTaskReminderIds(): Promise<Record<string, string[]>> {

  try {

    const raw = await AsyncStorage.getItem(TASK_REMINDER_IDS_KEY);

    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, string | string[]>;

    if (!parsed || typeof parsed !== 'object') return {};

    const normalized: Record<string, string[]> = {};

    for (const [taskId, value] of Object.entries(parsed)) {

      if (Array.isArray(value)) normalized[taskId] = value;

      else if (typeof value === 'string') normalized[taskId] = [value];

    }

    return normalized;

  } catch {

    return {};

  }

}



async function saveTaskReminderIds(map: Record<string, string[]>): Promise<void> {

  await AsyncStorage.setItem(TASK_REMINDER_IDS_KEY, JSON.stringify(map));

}



export async function cancelTaskReminder(taskId: string): Promise<void> {

  const ids = await loadTaskReminderIds();

  const notificationIds = ids[taskId] ?? [];

  for (const notificationId of notificationIds) {

    await Notifications.cancelScheduledNotificationAsync(notificationId);

  }

  delete ids[taskId];

  await saveTaskReminderIds(ids);

}



export async function scheduleTaskReminder(

  task: AgentTask,

  alertStyle: 'sound' | 'vibration' | 'silent' = 'sound',

): Promise<boolean> {

  const hasPermission = await ensureNotificationPermissions(alertStyle);

  if (!hasPermission) return false;



  const { tasksChannelId } = await ensureNotificationChannels(alertStyle);

  const { sound } = getNotificationContentOptions(alertStyle);



  await cancelTaskReminder(task.id);



  const scheduledIds: string[] = [];



  if (task.recurrence?.weekdays?.length) {

    const { weekdays, hour, minute } = task.recurrence;

    for (const jsWeekday of weekdays) {

      const notificationId = await Notifications.scheduleNotificationAsync({

        identifier: `task-${task.id}-w${jsWeekday}`,

        content: {

          title: getTranslations(getActiveLocale()).notifications.taskTitle,

          body: task.text,

          sound,

          data: { type: 'task', taskId: task.id, recurring: true },

          ...(Platform.OS === 'android' ? { channelId: tasksChannelId } : {}),

        },

        trigger: {

          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,

          weekday: expoWeekdayFromJs(jsWeekday),

          hour,

          minute,

        },

      });

      scheduledIds.push(notificationId);

    }

  } else if (task.remindAt && task.remindAt > Date.now()) {

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

    scheduledIds.push(notificationId);

  } else {

    return false;

  }



  const ids = await loadTaskReminderIds();

  ids[task.id] = scheduledIds;

  await saveTaskReminderIds(ids);

  return true;

}



export function formatTaskReminderLabel(

  task: AgentTask,

  localeTag = 'sv-SE',

): string | null {

  if (task.recurrence?.weekdays?.length) {

    const labels = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];

    const days = task.recurrence.weekdays.map((d) => labels[d] ?? String(d)).join(', ');

    const h = String(task.recurrence.hour).padStart(2, '0');

    const m = String(task.recurrence.minute).padStart(2, '0');

    return `Varje ${days} kl ${h}:${m}`;

  }

  if (task.remindAt) {

    return new Date(task.remindAt).toLocaleString(localeTag, {

      weekday: 'short',

      day: 'numeric',

      month: 'short',

      hour: '2-digit',

      minute: '2-digit',

    });

  }

  return null;

}


