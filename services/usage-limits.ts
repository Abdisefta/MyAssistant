import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ANALYTICS_API_KEY,
  ANALYTICS_BASE_URL,
  isAnalyticsConfigured,
} from '@/constants/analytics';
import type { AnalyticsEventType } from '@/services/analytics-sync';
import { getAnalyticsDeviceId } from '@/services/analytics-sync';

export type UsageLimitType = Extract<
  AnalyticsEventType,
  'assistant_message' | 'gemini_request' | 'tts_request'
>;

export type UsageCheckResult = {
  allowed: boolean;
  used: number;
  limit: number;
  message?: string;
};

const LOCAL_LIMITS = {
  assistant_message: 30,
  gemini_request: 30,
  tts_request: 40,
} as const;

const LOCAL_PREFIX = '@my_assistant_limit_';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function localUsageKey(type: UsageLimitType): Promise<string> {
  const deviceId = await getAnalyticsDeviceId();
  return `${LOCAL_PREFIX}${deviceId}_${type}_${todayKey()}`;
}

async function checkLocalLimit(type: UsageLimitType): Promise<UsageCheckResult> {
  const key = await localUsageKey(type);
  const raw = await AsyncStorage.getItem(key);
  const used = raw ? Number(raw) : 0;
  const limit = LOCAL_LIMITS[type];
  const allowed = used < limit;
  return {
    allowed,
    used,
    limit,
    message: allowed
      ? undefined
      : 'Du har nått dagens gräns för assistenten. Försök igen imorgon.',
  };
}

export async function checkUsageAllowed(type: UsageLimitType): Promise<UsageCheckResult> {
  if (!isAnalyticsConfigured()) {
    return checkLocalLimit(type);
  }
  try {
    const deviceId = await getAnalyticsDeviceId();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const url = `${ANALYTICS_BASE_URL}/api/limits/check?deviceId=${encodeURIComponent(deviceId)}&type=${encodeURIComponent(type)}`;
    const res = await fetch(url, {
      headers: { 'X-Analytics-Key': ANALYTICS_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = (await res.json()) as UsageCheckResult & { message?: string };
    if (!res.ok) {
      return checkLocalLimit(type);
    }
    return {
      allowed: data.allowed,
      used: data.used,
      limit: data.limit,
      message: data.allowed ? undefined : (data.message ?? 'Du har nått dagens gräns. Försök igen imorgon.'),
    };
  } catch {
    return checkLocalLimit(type);
  }
}

export async function bumpLocalUsage(type: UsageLimitType): Promise<void> {
  const key = await localUsageKey(type);
  const raw = await AsyncStorage.getItem(key);
  const used = raw ? Number(raw) : 0;
  await AsyncStorage.setItem(key, String(used + 1));
}
