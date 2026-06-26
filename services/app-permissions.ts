import { requestCalendarAccess } from '@/services/device-calendar';
import { ensureNotificationPermissions } from '@/services/meeting-reminders';

/** Be om kalender + notiser vid start (non-blocking). */
export async function bootstrapAppPermissions(): Promise<void> {
  try {
    await requestCalendarAccess();
  } catch {
    // ignore
  }
  try {
    await ensureNotificationPermissions();
  } catch {
    // ignore
  }
}
