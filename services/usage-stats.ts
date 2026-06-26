import AsyncStorage from '@react-native-async-storage/async-storage';

export type UsageStats = {
  appOpens: number;
  totalMinutes: number;
  assistantMessages: number;
  lastActiveAt: number;
  sessionsToday: number;
  lastSessionDate: string;
};

const STORAGE_PREFIX = '@my_assistant_usage_';

const DEFAULT_STATS: UsageStats = {
  appOpens: 0,
  totalMinutes: 0,
  assistantMessages: 0,
  lastActiveAt: 0,
  sessionsToday: 0,
  lastSessionDate: '',
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadStats(userId: string): Promise<UsageStats> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

async function saveStats(userId: string, stats: UsageStats): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(stats));
}

export async function getUsageStats(userId: string): Promise<UsageStats> {
  return loadStats(userId);
}

export async function recordAppOpen(userId: string): Promise<UsageStats> {
  const stats = await loadStats(userId);
  const today = todayKey();
  stats.appOpens += 1;
  stats.lastActiveAt = Date.now();
  if (stats.lastSessionDate !== today) {
    stats.lastSessionDate = today;
    stats.sessionsToday = 1;
  } else {
    stats.sessionsToday += 1;
  }
  await saveStats(userId, stats);
  return stats;
}

export async function recordUsageMinute(userId: string): Promise<void> {
  const stats = await loadStats(userId);
  stats.totalMinutes += 1;
  stats.lastActiveAt = Date.now();
  await saveStats(userId, stats);
}

export async function recordAssistantMessage(userId: string): Promise<void> {
  const stats = await loadStats(userId);
  stats.assistantMessages += 1;
  stats.lastActiveAt = Date.now();
  await saveStats(userId, stats);
}

export function formatUsageMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}
