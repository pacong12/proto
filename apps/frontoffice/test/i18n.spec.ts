import { describe, it, expect } from 'vitest';
import {
  currentLocale,
  setLocale,
  t,
  SUPPORTED_LOCALES,
  useI18n,
  messages,
  loadLocale,
} from '../src/lib/i18n';

// Loading the 11 locale files transforms each one on first import, which can pass the default
// 5 s timeout when other projects' tests run in parallel (nx run-many, CI).
describe('Internationalization (i18n) Engine', { timeout: 30_000 }, () => {
  // Runs first, before other tests load more locales.
  it('ships only English up front and loads other locales on demand', async () => {
    expect(Object.keys(messages)).not.toContain('ko');
    await setLocale('ko');
    expect(messages.ko).toBeDefined();
    expect(t('explore')).toBe('탐색');
    await setLocale('en');
  });

  it('supports all 11 major international languages', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(11);
    const codes = SUPPORTED_LOCALES.map((l) => l.code);

    expect(codes).toContain('en');
    expect(codes).toContain('id');
    expect(codes).toContain('zh');
    expect(codes).toContain('ja');
    expect(codes).toContain('ko');
    expect(codes).toContain('es');
    expect(codes).toContain('ru');
    expect(codes).toContain('ar');
    expect(codes).toContain('fr');
    expect(codes).toContain('de');
    expect(codes).toContain('pt');
  });

  it('translates core keywords across languages correctly', async () => {
    await setLocale('en');
    expect(t('explore')).toBe('Explore');
    expect(t('launchToken')).toBe('Launch Token');

    await setLocale('id');
    expect(t('explore')).toBe('Jelajahi');
    expect(t('launchToken')).toBe('Luncurkan Token');

    await setLocale('zh');
    expect(t('explore')).toBe('探索');
    expect(t('launchToken')).toBe('发射代币');

    await setLocale('ja');
    expect(t('explore')).toBe('見つける');
    expect(t('launchToken')).toBe('ローンチ');

    await setLocale('ko');
    expect(t('explore')).toBe('탐색');
    expect(t('launchToken')).toBe('토큰 런칭');

    await setLocale('es');
    expect(t('explore')).toBe('Explorar');
    expect(t('launchToken')).toBe('Lanzar Token');

    await setLocale('ru');
    expect(t('explore')).toBe('Обзор');

    await setLocale('ar');
    expect(t('explore')).toBe('استكشاف');

    // Reset back to English
    await setLocale('en');
    expect(currentLocale.value).toBe('en');
  });

  it('falls back to English when a translation key is missing in another language', async () => {
    await setLocale('ru');
    expect(t('non_existent_key_123')).toBe('non_existent_key_123');
    await setLocale('en');
  });

  it('guarantees zero missing keys across all 11 supported locales', async () => {
    await Promise.all(SUPPORTED_LOCALES.map((l) => loadLocale(l.code)));
    const enKeys = Object.keys(messages.en ?? {});
    expect(enKeys.length).toBeGreaterThan(250);

    for (const locale of SUPPORTED_LOCALES) {
      if (locale.code === 'en') continue;
      const currentKeys = Object.keys(messages[locale.code] ?? {});
      const missing = enKeys.filter((k) => !currentKeys.includes(k));
      expect(missing).toEqual([]);
      expect(currentKeys.length).toBe(enKeys.length);
    }
  });

  it('keeps the last requested locale when switches overlap', async () => {
    await Promise.all([setLocale('fr'), setLocale('de')]);
    expect(currentLocale.value).toBe('de');
    await setLocale('en');
  });

  it('provides reactive useI18n composable', async () => {
    const { locale, setLocale: setLoc, currentLocaleOption } = useI18n();
    await setLoc('ja');
    expect(locale.value).toBe('ja');
    expect(currentLocaleOption.value.name).toBe('Japanese');
    await setLoc('en');
  });
});
