import type { AppLocale, Translations } from '@/constants/i18n/types';
import { en } from '@/constants/i18n/translations/en';
import { da, fi, no, sv } from '@/constants/i18n/translations/nordic';
import {
  ar,
  bn,
  de,
  es,
  fr,
  hi,
  id,
  ja,
  ko,
  mr,
  pt,
  ru,
  sw,
  ta,
  te,
  tr,
  ur,
  vi,
  zh,
} from '@/constants/i18n/translations/world';

export const TRANSLATIONS: Record<AppLocale, Translations> = {
  en,
  sv,
  fi,
  da,
  no,
  de,
  es,
  fr,
  zh,
  hi,
  ar,
  bn,
  pt,
  ru,
  ur,
  id,
  ja,
  sw,
  mr,
  te,
  tr,
  ta,
  vi,
  ko,
};

export function getTranslations(locale: AppLocale): Translations {
  return TRANSLATIONS[locale] ?? en;
}

export function formatTranslation(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(vars[key] ?? ''),
  );
}

export function t(
  locale: AppLocale,
  path: string,
  vars?: Record<string, string | number>,
): string {
  const parts = path.split('.');
  let value: unknown = getTranslations(locale);
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      let fallback: unknown = getTranslations('en');
      for (const p of parts) {
        fallback =
          fallback && typeof fallback === 'object'
            ? (fallback as Record<string, unknown>)[p]
            : path;
      }
      return typeof fallback === 'string' ? formatTranslation(fallback, vars) : path;
    }
  }
  if (typeof value !== 'string') return path;
  return formatTranslation(value, vars);
}
