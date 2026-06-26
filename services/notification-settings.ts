import { Platform } from 'react-native';

import { getActiveLocale } from '@/constants/i18n';
import { getTranslations } from '@/constants/i18n/translations/index';
import * as Notifications from '@/services/notifications';

export type NotificationAlertStyle = 'sound' | 'vibration' | 'silent';

let activeAlertStyle: NotificationAlertStyle = 'sound';

export function setNotificationAlertStyle(style: NotificationAlertStyle): void {
  activeAlertStyle = style;
}

export function getNotificationAlertStyle(): NotificationAlertStyle {
  return activeAlertStyle;
}

function channelConfig(style: NotificationAlertStyle) {
  switch (style) {
    case 'vibration':
      return {
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: true,
        vibrationPattern: [0, 300, 150, 300],
      };
    case 'silent':
      return {
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        enableVibrate: false,
      };
    default:
      return {
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 250, 250, 250],
      };
  }
}

export async function ensureNotificationChannels(
  style: NotificationAlertStyle = activeAlertStyle,
): Promise<{ meetingsChannelId: string; tasksChannelId: string }> {
  setNotificationAlertStyle(style);
  const strings = getTranslations(getActiveLocale()).notifications;
  const meetingsChannelId = `meetings-${style}`;
  const tasksChannelId = `tasks-${style}`;

  if (Platform.OS === 'android') {
    const config = channelConfig(style);
    await Notifications.setNotificationChannelAsync(meetingsChannelId, {
      name: strings.meetingsChannel,
      ...config,
    });
    await Notifications.setNotificationChannelAsync(tasksChannelId, {
      name: strings.tasksChannel,
      ...config,
    });
  }

  return { meetingsChannelId, tasksChannelId };
}

export function getNotificationContentOptions(style: NotificationAlertStyle = activeAlertStyle): {
  sound: boolean;
  playSound: boolean;
} {
  return {
    sound: style === 'sound',
    playSound: style === 'sound',
  };
}

export function getForegroundNotificationBehavior(style: NotificationAlertStyle = activeAlertStyle) {
  return {
    shouldShowAlert: true,
    shouldPlaySound: style === 'sound',
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  };
}

export function installNotificationHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => getForegroundNotificationBehavior(getNotificationAlertStyle()),
    });
  } catch {
    // Begränsad miljö
  }
}

installNotificationHandler();
