import { APP_LOCALES, type AppLocale } from '@/constants/i18n/types';

type DeviceLocale = {
  languageCode?: string | null;
  regionCode?: string | null;
};

/** Telefonens språk via Intl — funkar utan ombyggd dev-klient. */
function readDeviceLocales(): DeviceLocale[] {
  try {
    const intl = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
    const normalized = intl.replace('_', '-');
    const parts = normalized.split('-');
    const languageCode = parts[0]?.toLowerCase() ?? 'en';
    const regionCode = parts[1]?.toLowerCase() ?? null;
    return [{ languageCode, regionCode }];
  } catch {
    return [{ languageCode: 'en', regionCode: null }];
  }
}

const LANGUAGE_MAP: Record<string, AppLocale> = {
  en: 'en',
  zh: 'zh',
  hi: 'hi',
  es: 'es',
  fr: 'fr',
  ar: 'ar',
  bn: 'bn',
  pt: 'pt',
  ru: 'ru',
  ur: 'ur',
  id: 'id',
  de: 'de',
  ja: 'ja',
  sw: 'sw',
  mr: 'mr',
  te: 'te',
  tr: 'tr',
  ta: 'ta',
  vi: 'vi',
  ko: 'ko',
  sv: 'sv',
  fi: 'fi',
  da: 'da',
  no: 'no',
  nb: 'no',
  nn: 'no',
};

/** Land → språk (Norden + vanliga regioner) */
const REGION_MAP: Record<string, AppLocale> = {
  se: 'sv',
  fi: 'fi',
  dk: 'da',
  no: 'no',
  us: 'en',
  gb: 'en',
  au: 'en',
  ca: 'en',
  de: 'de',
  at: 'de',
  ch: 'de',
  fr: 'fr',
  es: 'es',
  mx: 'es',
  ar: 'es',
  co: 'es',
  br: 'pt',
  pt: 'pt',
  cn: 'zh',
  tw: 'zh',
  hk: 'zh',
  jp: 'ja',
  kr: 'ko',
  in: 'hi',
  ru: 'ru',
  tr: 'tr',
  vn: 'vi',
  id: 'id',
  sa: 'ar',
  ae: 'ar',
  eg: 'ar',
  ke: 'sw',
  tz: 'sw',
};

export function resolveAppLocale(): AppLocale {
  const primary = readDeviceLocales()[0];
  const region = primary?.regionCode?.toLowerCase();
  const language = primary?.languageCode?.toLowerCase();

  if (region && REGION_MAP[region]) {
    return REGION_MAP[region];
  }

  if (language && LANGUAGE_MAP[language]) {
    return LANGUAGE_MAP[language];
  }

  return 'en';
}

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

/** BCP-47 för röst (TTS + taligenkänning) */
export function getSpeechLocale(appLocale: AppLocale): string {
  const map: Record<AppLocale, string> = {
    en: 'en-US',
    zh: 'zh-CN',
    hi: 'hi-IN',
    es: 'es-ES',
    fr: 'fr-FR',
    ar: 'ar-SA',
    bn: 'bn-IN',
    pt: 'pt-BR',
    ru: 'ru-RU',
    ur: 'ur-PK',
    id: 'id-ID',
    de: 'de-DE',
    ja: 'ja-JP',
    sw: 'sw-KE',
    mr: 'mr-IN',
    te: 'te-IN',
    tr: 'tr-TR',
    ta: 'ta-IN',
    vi: 'vi-VN',
    ko: 'ko-KR',
    sv: 'sv-SE',
    fi: 'fi-FI',
    da: 'da-DK',
    no: 'nb-NO',
  };
  return map[appLocale];
}
