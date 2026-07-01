/** Expo Go: inga push-notiser (SDK 53+). Stubbar undviker röda fel i terminalen. */

export type NotificationSubscription = { remove: () => void };

export type Notification = {
  request: {
    content: {
      data?: Record<string, unknown>;
      body?: string | null;
    };
  };
};

export const AndroidImportance = { HIGH: 4, DEFAULT: 3, LOW: 2 };

export const SchedulableTriggerInputTypes = {
  DATE: 'date' as const,
  WEEKLY: 'weekly' as const,
};

export function setNotificationHandler(_handler: unknown): void {}

export function addNotificationReceivedListener(
  _callback: (notification: Notification) => void,
): NotificationSubscription {
  return { remove: () => {} };
}

export async function setNotificationChannelAsync(
  _id: string,
  _channel: unknown,
): Promise<void> {}

export async function getPermissionsAsync(): Promise<{ status: string }> {
  return { status: 'denied' };
}

export async function requestPermissionsAsync(): Promise<{ status: string }> {
  return { status: 'denied' };
}

export async function cancelScheduledNotificationAsync(_id: string): Promise<void> {}

export async function scheduleNotificationAsync(_request: unknown): Promise<string> {
  return 'expo-go-stub';
}
