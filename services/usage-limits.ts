import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ANALYTICS_API_KEY,
  ANALYTICS_BASE_URL,
  isAnalyticsConfigured,
} from '@/constants/analytics';
import type { AnalyticsEventType } from '@/services/analytics-sync';
import { getAnalyticsDeviceId, trackAnalyticsEvent } from '@/services/analytics-sync';

export type UsageLimitType = Extract<
  AnalyticsEventType,
  'assistant_message' | 'gemini_request' | 'tts_request'
>;

export type UsageCheckResult = {
  allowed: boolean;
  used: number;
  limit: number;
  message?: string;
  period?: 'day' | 'month' | 'budget';
};

export class UsageLimitExceededError extends Error {
  readonly check: UsageCheckResult;

  constructor(check: UsageCheckResult) {
    super(check.message ?? 'Usage limit exceeded');
    this.name = 'UsageLimitExceededError';
    this.check = check;
  }
}

type LimitHitListener = (check: UsageCheckResult) => void;
const limitHitListeners = new Set<LimitHitListener>();

export function onUsageLimitHit(listener: LimitHitListener): () => void {
  limitHitListeners.add(listener);
  return () => limitHitListeners.delete(listener);
}

function notifyLimitHit(check: UsageCheckResult): void {
  for (const listener of limitHitListeners) {
    listener(check);
  }
}

/** Anropas t.ex. när analytics-servern svarar 429. */
export function reportUsageLimitHit(check: UsageCheckResult): void {
  notifyLimitHit(check);
}

export function isUsageLimitError(error: unknown): error is UsageLimitExceededError {
  return error instanceof UsageLimitExceededError;
}

export function isUsageLimitMessage(message: string): boolean {
  return /gräns|gränsen|limit|kostnadsgräns/i.test(message);
}

const LOCAL_DAILY_LIMITS = {
  assistant_message: 15,
  gemini_request: 15,
  tts_request: 20,
} as const;

const LOCAL_MONTHLY_LIMITS = {
  assistant_message: 400,
  gemini_request: 400,
  tts_request: 500,
} as const;

const LOCAL_PREFIX = '@my_assistant_limit_';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function defaultMessageForPeriod(period?: string): string {
  switch (period) {
    case 'month':
      return 'Du har nått månadens gräns. Försök igen nästa månad.';
    case 'budget':
      return 'Månadens kostnadsgräns är nådd. Försök igen nästa månad.';
    default:
      return 'Du har nått dagens gräns. Försök igen imorgon.';
  }
}

async function localDailyUsageKey(type: UsageLimitType): Promise<string> {
  const deviceId = await getAnalyticsDeviceId();
  return `${LOCAL_PREFIX}${deviceId}_${type}_day_${todayKey()}`;
}

async function localMonthlyUsageKey(type: UsageLimitType): Promise<string> {
  const deviceId = await getAnalyticsDeviceId();
  return `${LOCAL_PREFIX}${deviceId}_${type}_month_${monthKey()}`;
}

async function checkLocalLimit(type: UsageLimitType): Promise<UsageCheckResult> {
  const dayStorageKey = await localDailyUsageKey(type);
  const monthStorageKey = await localMonthlyUsageKey(type);
  const dayRaw = await AsyncStorage.getItem(dayStorageKey);
  const monthRaw = await AsyncStorage.getItem(monthStorageKey);
  const usedDay = dayRaw ? Number(dayRaw) : 0;
  const usedMonth = monthRaw ? Number(monthRaw) : 0;
  const dayLimit = LOCAL_DAILY_LIMITS[type];
  const monthLimit = LOCAL_MONTHLY_LIMITS[type];

  if (usedDay >= dayLimit) {
    return {
      allowed: false,
      used: usedDay,
      limit: dayLimit,
      period: 'day',
      message: 'Du har nått dagens gräns för assistenten. Försök igen imorgon.',
    };
  }
  if (usedMonth >= monthLimit) {
    return {
      allowed: false,
      used: usedMonth,
      limit: monthLimit,
      period: 'month',
      message: 'Du har nått månadens gräns. Försök igen nästa månad.',
    };
  }
  return {
    allowed: true,
    used: usedDay,
    limit: dayLimit,
  };
}

function finalizeCheck(result: UsageCheckResult): UsageCheckResult {
  if (!result.allowed) {
    notifyLimitHit(result);
  }
  return result;
}

export async function checkUsageAllowed(type: UsageLimitType): Promise<UsageCheckResult> {
  if (!isAnalyticsConfigured()) {
    return finalizeCheck(await checkLocalLimit(type));
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
    const data = (await res.json()) as UsageCheckResult & { message?: string; period?: string };
    if (!res.ok) {
      return finalizeCheck(await checkLocalLimit(type));
    }
    const result: UsageCheckResult = {
      allowed: data.allowed,
      used: data.used,
      limit: data.limit,
      period: data.period as UsageCheckResult['period'],
      message: data.allowed
        ? undefined
        : (data.message ?? defaultMessageForPeriod(data.period)),
    };
    return finalizeCheck(result);
  } catch {
    return finalizeCheck(await checkLocalLimit(type));
  }
}

export async function bumpLocalUsage(type: UsageLimitType): Promise<void> {
  const dayStorageKey = await localDailyUsageKey(type);
  const monthStorageKey = await localMonthlyUsageKey(type);
  const dayRaw = await AsyncStorage.getItem(dayStorageKey);
  const monthRaw = await AsyncStorage.getItem(monthStorageKey);
  await AsyncStorage.setItem(dayStorageKey, String((dayRaw ? Number(dayRaw) : 0) + 1));
  await AsyncStorage.setItem(monthStorageKey, String((monthRaw ? Number(monthRaw) : 0) + 1));
}

/** Registrera lyckad användning — server eller lokal räknare. */
export async function recordBillableUsage(
  type: UsageLimitType,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (isAnalyticsConfigured()) {
    await trackAnalyticsEvent(type as AnalyticsEventType, meta);
  } else {
    await bumpLocalUsage(type);
  }
}
