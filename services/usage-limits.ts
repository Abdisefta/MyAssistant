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
  period?: 'day' | 'month' | 'budget' | 'blocked';
};

export type BudgetStatus = {
  costMonth: number;
  budget: number;
  percent: number;
  level: 'ok' | 'warning' | 'exceeded' | 'blocked';
  message?: string;
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

export const MONTHLY_BUDGET_SEK = 35;
const COST_GEMINI_SEK = 0.06;
const COST_TTS_SEK = 0.002;
const BUDGET_WARNING_PCT = 80;

const LOCAL_PREFIX = '@my_assistant_limit_';

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function budgetExceededMessage(): string {
  return `Du har nått månadens kostnadsgräns (${MONTHLY_BUDGET_SEK} kr). Köp ett nytt paket för att fortsätta använda assistenten.`;
}

const BLOCKED_MESSAGE =
  'Ditt konto är tillfälligt spärrat. Kontakta support om du tror att detta är ett misstag.';

function defaultMessageForPeriod(period?: string): string {
  if (period === 'blocked') return BLOCKED_MESSAGE;
  if (period === 'budget') return budgetExceededMessage();
  return budgetExceededMessage();
}

export function onUsageLimitHit(listener: LimitHitListener): () => void {
  limitHitListeners.add(listener);
  return () => limitHitListeners.delete(listener);
}

function notifyLimitHit(check: UsageCheckResult): void {
  for (const listener of limitHitListeners) {
    listener(check);
  }
}

export function reportUsageLimitHit(check: UsageCheckResult): void {
  notifyLimitHit(check);
}

export function isUsageLimitError(error: unknown): error is UsageLimitExceededError {
  return error instanceof UsageLimitExceededError;
}

export function isUsageLimitMessage(message: string): boolean {
  return /gräns|gränsen|limit|kostnadsgräns|paket|budget|spärr/i.test(message);
}

async function localUsageKey(type: 'gemini_request' | 'tts_request'): Promise<string> {
  const deviceId = await getAnalyticsDeviceId();
  return `${LOCAL_PREFIX}${deviceId}_${type}_month_${monthKey()}`;
}

async function getLocalBillableCounts(): Promise<{ gemini: number; tts: number }> {
  const geminiRaw = await AsyncStorage.getItem(await localUsageKey('gemini_request'));
  const ttsRaw = await AsyncStorage.getItem(await localUsageKey('tts_request'));
  return {
    gemini: geminiRaw ? Number(geminiRaw) : 0,
    tts: ttsRaw ? Number(ttsRaw) : 0,
  };
}

function estimateCost(gemini: number, tts: number): number {
  return Math.round((gemini * COST_GEMINI_SEK + tts * COST_TTS_SEK) * 100) / 100;
}

function buildBudgetStatus(costMonth: number): BudgetStatus {
  const budget = MONTHLY_BUDGET_SEK;
  const percent = budget > 0 ? Math.round((costMonth / budget) * 100) : 0;
  const warningThreshold = (budget * BUDGET_WARNING_PCT) / 100;

  if (costMonth >= budget) {
    return {
      costMonth,
      budget,
      percent,
      level: 'exceeded',
      message: budgetExceededMessage(),
    };
  }
  if (costMonth >= warningThreshold) {
    return {
      costMonth,
      budget,
      percent,
      level: 'warning',
      message: `Du har använt ${Math.round(costMonth)} av ${budget} kr denna månad. Köp nytt paket snart så assistenten inte pausas.`,
    };
  }
  return { costMonth, budget, percent, level: 'ok' };
}

async function checkLocalBudget(type: UsageLimitType): Promise<UsageCheckResult> {
  if (type === 'assistant_message') {
    return { allowed: true, used: 0, limit: MONTHLY_BUDGET_SEK };
  }

  const counts = await getLocalBillableCounts();
  const costMonth = estimateCost(counts.gemini, counts.tts);
  const nextCost =
    type === 'gemini_request' ? COST_GEMINI_SEK : type === 'tts_request' ? COST_TTS_SEK : 0;

  if (nextCost > 0 && costMonth + nextCost > MONTHLY_BUDGET_SEK) {
    return {
      allowed: false,
      used: costMonth,
      limit: MONTHLY_BUDGET_SEK,
      period: 'budget',
      message: budgetExceededMessage(),
    };
  }
  return { allowed: true, used: costMonth, limit: MONTHLY_BUDGET_SEK };
}

function finalizeCheck(result: UsageCheckResult): UsageCheckResult {
  if (!result.allowed) {
    notifyLimitHit(result);
  }
  return result;
}

export async function checkUsageAllowed(type: UsageLimitType): Promise<UsageCheckResult> {
  if (!isAnalyticsConfigured()) {
    return finalizeCheck(await checkLocalBudget(type));
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
      return finalizeCheck(await checkLocalBudget(type));
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
    return finalizeCheck(await checkLocalBudget(type));
  }
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
  if (!isAnalyticsConfigured()) {
    const counts = await getLocalBillableCounts();
    return buildBudgetStatus(estimateCost(counts.gemini, counts.tts));
  }
  try {
    const deviceId = await getAnalyticsDeviceId();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const url = `${ANALYTICS_BASE_URL}/api/limits/budget?deviceId=${encodeURIComponent(deviceId)}`;
    const res = await fetch(url, {
      headers: { 'X-Analytics-Key': ANALYTICS_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const counts = await getLocalBillableCounts();
      return buildBudgetStatus(estimateCost(counts.gemini, counts.tts));
    }
    return (await res.json()) as BudgetStatus;
  } catch {
    const counts = await getLocalBillableCounts();
    return buildBudgetStatus(estimateCost(counts.gemini, counts.tts));
  }
}

async function bumpLocalUsage(type: UsageLimitType): Promise<void> {
  if (type === 'assistant_message') return;
  if (type !== 'gemini_request' && type !== 'tts_request') return;
  const storageKey = await localUsageKey(type);
  const raw = await AsyncStorage.getItem(storageKey);
  await AsyncStorage.setItem(storageKey, String((raw ? Number(raw) : 0) + 1));
}

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
