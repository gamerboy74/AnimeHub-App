import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { userAPI } from '../lib/supabase';
import { translations, LocaleCode, TranslationKey } from '../constants/translations';

type LocalizationContextType = {
  locale: LocaleCode;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
};

const LocalizationContext = createContext<LocalizationContextType>({} as LocalizationContextType);

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Fetch preferences via TanStack Query (leveraging cache)
  const { data: prefs } = useQuery({
    queryKey: ['user', user?.id, 'preferences'],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await userAPI.getPreferences(user.id);
      return data;
    },
    enabled: !!user?.id,
  });

  // Dynamically resolve locale from DB preferred_language setting
  const locale = useMemo<LocaleCode>(() => {
    const displayLanguage = prefs?.preferred_language || 'en';
    if (displayLanguage === 'ja' || displayLanguage === '日本語 (Japanese)') return 'ja';
    return 'en';
  }, [prefs?.preferred_language]);

  // Reactive translation function
  const t = useMemo(() => {
    return (key: TranslationKey, variables?: Record<string, string | number>) => {
      const dictionary = translations[locale] || translations.en;
      let text = dictionary[key] || translations.en[key] || String(key);
      
      if (variables) {
        Object.entries(variables).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }
      return text;
    };
  }, [locale]);

  const contextValue = useMemo(() => ({ locale, t }), [locale, t]);

  return (
    <LocalizationContext.Provider value={contextValue}>
      {children}
    </LocalizationContext.Provider>
  );
}

export const useTranslation = () => useContext(LocalizationContext);
export type { LocaleCode, TranslationKey };
