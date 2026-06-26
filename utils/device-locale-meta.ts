/** Locale/land från telefon — skickas anonymt till analytics (ingen PII). */
export function getDeviceLocaleMeta(): {
  locale: string;
  country: string | null;
  timezone: string;
} {
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    const locale = opts.locale ?? 'en';
    const timezone = opts.timeZone ?? 'UTC';
    const parts = locale.replace('_', '-').split('-');
    const country = parts[1]?.toUpperCase() ?? null;
    return { locale, country, timezone };
  } catch {
    return { locale: 'en', country: null, timezone: 'UTC' };
  }
}
