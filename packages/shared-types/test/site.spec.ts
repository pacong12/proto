import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_URL, DEFAULT_DOCS_URL, renderSiteUrls, resolveSiteUrls } from '../src';

describe('site URLs', () => {
  it('defaults to the production domains', () => {
    expect(resolveSiteUrls()).toEqual({
      appUrl: DEFAULT_APP_URL,
      appHost: 'goton.fun',
      docsUrl: DEFAULT_DOCS_URL,
      docsHost: 'docs.goton.fun',
    });
  });

  it('uses overrides and strips trailing slashes', () => {
    const urls = resolveSiteUrls({
      appUrl: 'https://staging.example.com/',
      docsUrl: 'https://docs.staging.example.com//',
    });
    expect(urls.appUrl).toBe('https://staging.example.com');
    expect(urls.docsHost).toBe('docs.staging.example.com');
  });

  it('treats empty overrides as unset', () => {
    expect(resolveSiteUrls({ appUrl: '', docsUrl: '' }).appUrl).toBe(DEFAULT_APP_URL);
  });

  it('renders placeholders in static files', () => {
    const text = 'Sitemap: %APP_URL%/sitemap.xml\nHost: %APP_HOST%\nDocs: %DOCS_URL% (%DOCS_HOST%)';
    expect(renderSiteUrls(text, resolveSiteUrls())).toBe(
      'Sitemap: https://goton.fun/sitemap.xml\nHost: goton.fun\nDocs: https://docs.goton.fun (docs.goton.fun)',
    );
  });
});
