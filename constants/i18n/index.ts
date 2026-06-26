import { resolveAppLocale } from '@/constants/i18n/resolve-locale';
import type { AppLocale } from '@/constants/i18n/types';

export { formatTranslation, getTranslations, t } from '@/constants/i18n/translations/index';
export type { AppLocale, Translations } from '@/constants/i18n/types';
export { resolveAppLocale, getSpeechLocale } from '@/constants/i18n/resolve-locale';

let activeLocale: AppLocale | undefined;

function ensureActiveLocale(): AppLocale {
  if (!activeLocale) {
    activeLocale = resolveAppLocale();
  }
  return activeLocale;
}

export function setActiveLocale(locale: AppLocale): void {
  activeLocale = locale;
}

export function getActiveLocale(): AppLocale {
  return ensureActiveLocale();
}
