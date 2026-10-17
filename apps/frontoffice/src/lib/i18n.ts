import { ref, computed, shallowReactive } from 'vue';
import en from './locales/en';

export type SupportedLocale =
  | 'en' // English
  | 'id' // Bahasa Indonesia
  | 'zh' // Chinese (Simplified)
  | 'ja' // Japanese
  | 'ko' // Korean
  | 'es' // Spanish
  | 'ru' // Russian
  | 'ar' // Arabic
  | 'fr' // French
  | 'de' // German
  | 'pt'; // Portuguese

export interface LocaleOption {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
];

type Messages = Record<string, string>;

/**
 * English ships in the main bundle and is the fallback for missing keys. Other locales are
 * separate chunks loaded on first use, so the initial download does not carry all 11 languages.
 */
const loaders: Record<Exclude<SupportedLocale, 'en'>, () => Promise<{ default: Messages }>> = {
  id: () => import('./locales/id'),
  zh: () => import('./locales/zh'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  es: () => import('./locales/es'),
  ru: () => import('./locales/ru'),
  ar: () => import('./locales/ar'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  pt: () => import('./locales/pt'),
};

/** Loaded locales. Reactive, so text re-renders when a locale finishes loading. */
export const messages = shallowReactive<Partial<Record<SupportedLocale, Messages>>>({ en });

function isSupportedLocale(code: string | null | undefined): code is SupportedLocale {
  return !!code && SUPPORTED_LOCALES.some((l) => l.code === code);
}

export async function loadLocale(locale: SupportedLocale): Promise<void> {
  if (messages[locale] || locale === 'en') return;
  messages[locale] = (await loaders[locale]()).default;
}

const STORAGE_LOCALE_KEY = 'proto_selected_locale_v1';

function getInitialLocale(): SupportedLocale {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_LOCALE_KEY);
      if (isSupportedLocale(saved)) {
        return saved;
      }
      const navLang = navigator.language?.slice(0, 2).toLowerCase();
      if (isSupportedLocale(navLang)) {
        return navLang;
      }
    } catch {
      // Ignore
    }
  }
  return 'en';
}

export const currentLocale = ref<SupportedLocale>(getInitialLocale());
// Until the saved locale arrives, t() falls back to English.
void loadLocale(currentLocale.value).catch(() => undefined);

let pendingLocale: SupportedLocale | null = null;

/** Switches after the locale's strings are loaded, so the page never shows a mix. */
export async function setLocale(locale: SupportedLocale): Promise<void> {
  if (!isSupportedLocale(locale)) return;
  pendingLocale = locale;
  await loadLocale(locale);
  if (pendingLocale !== locale) return; // a later call won
  currentLocale.value = locale;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_LOCALE_KEY, locale);
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    } catch {
      // Ignore
    }
  }
}

export function t(key: string): string {
  const loc = currentLocale.value;
  return messages[loc]?.[key] ?? en[key] ?? key;
}

export function useI18n() {
  return {
    locale: currentLocale,
    locales: SUPPORTED_LOCALES,
    setLocale,
    t,
    currentLocaleOption: computed(
      () => SUPPORTED_LOCALES.find((l) => l.code === currentLocale.value) || SUPPORTED_LOCALES[0],
    ),
  };
}
