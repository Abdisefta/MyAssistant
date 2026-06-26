import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { formatTranslation, getTranslations, resolveAppLocale, setActiveLocale, t as translate } from '@/constants/i18n';
import type { AppLocale, Translations } from '@/constants/i18n/types';

type LocaleContextValue = {
  locale: AppLocale;
  strings: Translations;
  t: (path: string, vars?: Record<string, string | number>) => string;
  format: typeof formatTranslation;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useMemo(() => {
    const resolved = resolveAppLocale();
    setActiveLocale(resolved);
    return resolved;
  }, []);
  const strings = useMemo(() => getTranslations(locale), [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      strings,
      t: (path, vars) => translate(locale, path, vars),
      format: formatTranslation,
    }),
    [locale, strings],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
