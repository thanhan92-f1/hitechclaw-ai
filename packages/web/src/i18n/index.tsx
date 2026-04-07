import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Locale, Translations } from './types';
import { en } from './en';
import { vi } from './vi';

const translations: Record<Locale, Translations> = { en, vi };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof Translations) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'hitechclaw-locale';

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'vi') return stored;
  } catch {}
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try { localStorage.setItem(STORAGE_KEY, newLocale); } catch {}
  }, []);

  const t = useCallback((key: keyof Translations): string => {
    return translations[locale][key] ?? key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export type { Locale, Translations };
