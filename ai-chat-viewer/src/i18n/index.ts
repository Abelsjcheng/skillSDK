import { useCallback, useSyncExternalStore } from 'react';
import { messages, type AppLanguage, type MessageKey } from './messages';

type MessageParams = Record<string, string | number>;

let currentLanguage: AppLanguage = 'zh';
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function updateDocumentLanguage(language: AppLanguage): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

function formatMessage(template: string, params?: MessageParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? '' : String(value);
  });
}

export function normalizeLanguage(language?: string | null): AppLanguage {
  return language === 'en' ? 'en' : 'zh';
}

export function getLanguage(): AppLanguage {
  return currentLanguage;
}

export function setLanguage(language?: string | null): AppLanguage {
  const nextLanguage = normalizeLanguage(language);
  if (nextLanguage === currentLanguage) {
    updateDocumentLanguage(nextLanguage);
    return currentLanguage;
  }

  currentLanguage = nextLanguage;
  updateDocumentLanguage(currentLanguage);
  notifyListeners();
  return currentLanguage;
}

export function t(key: MessageKey, params?: MessageParams, language = currentLanguage): string {
  const normalizedLanguage = normalizeLanguage(language);
  const localizedMessages = messages[normalizedLanguage];
  const fallbackMessages = messages.zh;
  const template = localizedMessages[key] ?? fallbackMessages[key] ?? key;
  return formatMessage(template, params);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLanguage(): AppLanguage {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

export function useI18n(): {
  language: AppLanguage;
  t: (key: MessageKey, params?: MessageParams) => string;
} {
  const language = useLanguage();
  const translate = useCallback((key: MessageKey, params?: MessageParams) => t(key, params, language), [language]);

  return {
    language,
    t: translate,
  };
}

updateDocumentLanguage(currentLanguage);
