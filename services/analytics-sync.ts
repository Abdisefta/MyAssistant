import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { APP_VERSION } from '@/constants/app-version';
import {
  ANALYTICS_API_KEY,
  ANALYTICS_BASE_URL,
  isAnalyticsConfigured,
} from '@/constants/analytics';

export type AnalyticsEventType =
  | 'install'
  | 'app_open'
  | 'assistant_message'
  | 'tts_request'
  | 'gemini_request';

const DEVICE_ID_KEY = '@my_assistant_device_id';
const INSTALL_SENT_KEY = '@my_assistant_install_sent';

async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export async function getAnalyticsDeviceId(): Promise<string> {
  return getDeviceId();
}

export async function trackAnalyticsEvent(
  type: AnalyticsEventType,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (!isAnalyticsConfigured()) return;
  try {
    const deviceId = await getDeviceId();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    await fetch(`${ANALYTICS_BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Analytics-Key': ANALYTICS_API_KEY,
      },
      body: JSON.stringify({
        type,
        deviceId,
        appVersion: APP_VERSION,
        platform: Platform.OS,
        meta: meta ?? {},
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // Analytics ska aldrig störa appen
  }
}

/** Första start = install-event, sedan app_open. */
export async function trackAppLaunch(): Promise<void> {
  const installSent = await AsyncStorage.getItem(INSTALL_SENT_KEY);
  if (!installSent) {
    await trackAnalyticsEvent('install');
    await AsyncStorage.setItem(INSTALL_SENT_KEY, '1');
  }
  await trackAnalyticsEvent('app_open');
}
