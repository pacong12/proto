import { describe, expect, it } from 'vitest';
import { legalUrl, resolveDocsUrl } from '../src/lib/site';

const at = (href: string) => new URL(href) as unknown as Location;

describe('docs and legal URLs', () => {
  it('uses the configured docs domain in production', () => {
    expect(resolveDocsUrl(at('https://goton.fun/launchpad'))).toBe('https://docs.goton.fun');
  });

  it('maps workers.dev hosts to their docs worker', () => {
    expect(resolveDocsUrl(at('https://proto.acme.workers.dev/'))).toBe(
      'https://proto-docs.acme.workers.dev',
    );
    expect(resolveDocsUrl(at('https://proto-dev.acme.workers.dev/'))).toBe(
      'https://proto-docs-dev.acme.workers.dev',
    );
  });

  it('points at local docs during development', () => {
    expect(resolveDocsUrl(at('http://localhost:3010/'))).toBe('http://localhost:3002');
  });

  it('links translated legal pages where the docs have them', () => {
    // No window in this environment, so the configured docs URL is used.
    expect(legalUrl('terms-of-service')).toBe('https://docs.goton.fun/terms-of-service');
    expect(legalUrl('privacy-policy', 'id')).toBe('https://docs.goton.fun/id/privacy-policy');
    expect(legalUrl('cookie-policy', 'zh')).toBe('https://docs.goton.fun/zh/cookie-policy');
    expect(legalUrl('cookie-policy', 'de')).toBe('https://docs.goton.fun/cookie-policy');
  });
});
