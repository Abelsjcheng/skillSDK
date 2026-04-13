import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './resources/en';
import { zh } from './resources/zh';
import { getAppInfo, registerAppLanguageListener } from '../utils/hwext';

export type AppLanguage = 'zh' | 'en';

export const resources = {
  zh: {
    translation: zh,
  },
  en: {
    translation: en,
  },
} as const;

let languageInitPromise: Promise<void> | null = null;

function updateDocumentLanguage(language: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

export function normalizeLanguage(language?: string | null): AppLanguage {
  const normalizedLanguage = String(language ?? '')
    .trim()
    .replace(/_/g, '-')
    .toLowerCase();

  return normalizedLanguage.startsWith('en') ? 'en' : 'zh';
}

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: 'zh',
      fallbackLng: 'zh',
      defaultNS: 'translation',
      ns: ['translation'],
      react: {
        useSuspense: false,
      },
      interpolation: {
        escapeValue: false,
      },
      returnNull: false,
    });

  i18n.on('languageChanged', (language) => {
    updateDocumentLanguage(normalizeLanguage(language));
  });
}

updateDocumentLanguage(normalizeLanguage(i18n.language));

export function ensureLanguageInitialized(): Promise<void> {
  if (languageInitPromise) {
    return languageInitPromise;
  }

  languageInitPromise = (async () => {
    registerAppLanguageListener((language) => {
      void i18n.changeLanguage(language);
    });

    try {
      const appInfo = await getAppInfo();
      await i18n.changeLanguage(normalizeLanguage(appInfo.language));
    } catch (error) {
      console.error('ensureLanguageInitialized failed:', error);
      await i18n.changeLanguage('zh');
    }
  })();

  return languageInitPromise;
}

export default i18n;
