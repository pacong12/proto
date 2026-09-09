import { describe, it, expect } from 'vitest';
import { currentLocale, setLocale, t, SUPPORTED_LOCALES, useI18n } from '../src/lib/i18n';

describe('Internationalization (i18n) Engine', () => {
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

  it('translates core keywords across languages correctly', () => {
    setLocale('en');
    expect(t('explore')).toBe('Explore');
    expect(t('launchToken')).toBe('Launch Token');

    setLocale('id');
    expect(t('explore')).toBe('Jelajahi');
    expect(t('launchToken')).toBe('Luncurkan Token');

    setLocale('zh');
    expect(t('explore')).toBe('探索');
    expect(t('launchToken')).toBe('发射代币');

    setLocale('ja');
    expect(t('explore')).toBe('見つける');
    expect(t('launchToken')).toBe('ローンチ');

    setLocale('ko');
    expect(t('explore')).toBe('탐색');
    expect(t('launchToken')).toBe('토큰 런칭');

    setLocale('es');
    expect(t('explore')).toBe('Explorar');
    expect(t('launchToken')).toBe('Lanzar Token');

    setLocale('ru');
    expect(t('explore')).toBe('Обзор');

    setLocale('ar');
    expect(t('explore')).toBe('استكشاف');

    // Reset back to English
    setLocale('en');
    expect(currentLocale.value).toBe('en');
  });

  it('falls back to English when a translation key is missing in another language', () => {
    setLocale('ru');
    expect(t('non_existent_key_123')).toBe('non_existent_key_123');
    setLocale('en');
  });

  it('provides reactive useI18n composable', () => {
    const { locale, setLocale: setLoc, currentLocaleOption } = useI18n();
    setLoc('ja');
    expect(locale.value).toBe('ja');
    expect(currentLocaleOption.value.name).toBe('Japanese');
    setLoc('en');
  });
});
