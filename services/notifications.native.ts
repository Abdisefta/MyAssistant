export {
  AndroidImportance,
  SchedulableTriggerInputTypes,
  addNotificationReceivedListener,
  cancelScheduledNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';

export type NotificationSubscription = { remove: () => void };

export type { Notification } from 'expo-notifications';
