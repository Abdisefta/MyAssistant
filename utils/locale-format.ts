import { getActiveLocale } from '@/constants/i18n';
import { getSpeechLocale } from '@/constants/i18n/resolve-locale';
import { getTranslations } from '@/constants/i18n/translations/index';

export function getFormatTag(): string {
  return getSpeechLocale(getActiveLocale());
}

export function formatDayLabel(date: Date, tag = getFormatTag()): string {
  const strings = getTranslations(getActiveLocale());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return strings.calendar.today;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target.getTime() === tomorrow.getTime()) return strings.calendar.tomorrow;

  return date.toLocaleDateString(tag, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatEventTimeRange(start: Date, end: Date, tag = getFormatTag()): string {
  const strings = getTranslations(getActiveLocale());
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  return `${start.toLocaleTimeString(tag, opts)} – ${end.toLocaleTimeString(tag, opts)}`;
}

export function formatAllDay(): string {
  return getTranslations(getActiveLocale()).calendar.allDay;
}
