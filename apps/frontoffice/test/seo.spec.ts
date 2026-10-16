// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TITLE, setPageSeo } from '../src/lib/seo';

const meta = (sel: string) => document.head.querySelector(sel)?.getAttribute('content');

describe('setPageSeo', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('writes title, description, robots, social tags and a canonical URL on the app domain', () => {
    setPageSeo('/analytics', { title: 'Analytics', description: 'Protocol stats' });
    expect(document.title).toBe('Analytics · goton');
    expect(meta('meta[name="description"]')).toBe('Protocol stats');
    expect(meta('meta[name="robots"]')).toContain('index, follow');
    expect(meta('meta[property="og:title"]')).toBe('Analytics · goton');
    expect(meta('meta[property="og:url"]')).toBe('https://goton.fun/analytics');
    expect(meta('meta[name="twitter:url"]')).toBe('https://goton.fun/analytics');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://goton.fun/analytics',
    );
  });

  it('falls back to the default title and marks private pages noindex', () => {
    setPageSeo('/u/0xabc', { noindex: true });
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(meta('meta[name="robots"]')).toBe('noindex, follow');
  });

  it('updates existing tags instead of adding duplicates', () => {
    setPageSeo('/a', { title: 'A' });
    setPageSeo('/b', { title: 'B' });
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(meta('meta[property="og:url"]')).toBe('https://goton.fun/b');
  });

  it('uses the bare domain for the home page', () => {
    setPageSeo('/');
    expect(meta('meta[property="og:url"]')).toBe('https://goton.fun');
  });
});
