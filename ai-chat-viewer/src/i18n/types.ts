import 'i18next';
import type { zh } from './resources/zh';

export type TranslationKey = keyof typeof zh;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof zh;
    };
  }
}

