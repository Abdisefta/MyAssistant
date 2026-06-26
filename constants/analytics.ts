/** Analytics admin server — events from app, dashboard for owner. */
export const ANALYTICS_BASE_URL = (
  process.env.EXPO_PUBLIC_ANALYTICS_URL ?? 'http://195.201.128.118:3002'
).replace(/\/$/, '');

export const ANALYTICS_API_KEY =
  process.env.EXPO_PUBLIC_ANALYTICS_API_KEY ?? 'myassistant-analytics-key';

export function isAnalyticsConfigured(): boolean {
  return Boolean(ANALYTICS_BASE_URL && ANALYTICS_API_KEY);
}
