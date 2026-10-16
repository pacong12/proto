import { test, expect, type Page } from '@playwright/test';

/**
 * Acceptance and regression checks for site-level behavior: SEO per page, 404, the maintenance
 * banner, analytics consent and on-demand wallet loading. Runs against the production build.
 */

async function head(page: Page, selector: string, attr: string): Promise<string | null> {
  return page.locator(selector).first().getAttribute(attr);
}

test.describe('SEO', () => {
  test('each page has its own title and a canonical URL on the production domain', async ({
    page,
  }) => {
    await page.goto('/analytics');
    await expect(page).toHaveTitle('Analytics · goton');
    expect(await head(page, 'link[rel="canonical"]', 'href')).toBe('https://goton.fun/analytics');
    expect(await head(page, 'meta[property="og:url"]', 'content')).toBe(
      'https://goton.fun/analytics',
    );
    expect(await head(page, 'meta[name="description"]', 'content')).toContain('Protocol volume');

    await page.goto('/launchpad/create');
    await expect(page).toHaveTitle('Create a token · goton');
    expect(await head(page, 'meta[name="robots"]', 'content')).toContain('index, follow');
  });
});

test.describe('404', () => {
  test('unknown routes show a noindex 404 page instead of redirecting', async ({ page }) => {
    await page.goto('/this/route/does-not-exist');
    await expect(page).toHaveURL(/\/this\/route\/does-not-exist$/);
    await expect(page.getByText('404', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Page not found · goton');
    expect(await head(page, 'meta[name="robots"]', 'content')).toContain('noindex');

    await page.getByRole('link', { name: /back to launchpad/i }).click();
    await expect(page).toHaveURL(/\/launchpad$/);
  });
});

test.describe('Maintenance banner', () => {
  test('shows the worker message, and a dismissal lasts for the session', async ({ page }) => {
    await page.route('**/site-status.json', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ maintenance: 'banner', message: 'Upgrade at 14:00 UTC' }),
      }),
    );
    await page.goto('/launchpad');
    const banner = page.getByRole('status').filter({ hasText: 'Upgrade at 14:00 UTC' });
    await expect(banner).toBeVisible();

    await banner.getByRole('button').click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByText('Upgrade at 14:00 UTC')).toBeHidden();
  });

  test('stays hidden when maintenance is off', async ({ page }) => {
    await page.route('**/site-status.json', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ maintenance: 'off', message: '' }),
      }),
    );
    await page.goto('/launchpad');
    await expect(page.locator('[role="status"]').filter({ hasText: /maintenance/i })).toHaveCount(
      0,
    );
  });
});

test.describe('Privacy', () => {
  test('Google Analytics loads only after the visitor accepts cookies', async ({ page }) => {
    const gaRequests: string[] = [];
    await page.route('**/www.googletagmanager.com/**', (route) => {
      gaRequests.push(route.request().url());
      return route.fulfill({ contentType: 'application/javascript', body: '' });
    });
    await page.goto('/launchpad');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500);
    expect(gaRequests).toHaveLength(0);

    await page
      .getByRole('dialog', { name: /cookie consent/i })
      .getByRole('button', { name: /accept/i })
      .click();
    await expect.poll(() => gaRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
  });
});

test.describe('Performance guards', () => {
  test('the wallet stack (AppKit) is not downloaded on page load', async ({ page }) => {
    const appKitChunks: string[] = [];
    page.on('request', (req) => {
      if (/\/assets\/appkit-/.test(req.url())) appKitChunks.push(req.url());
    });
    await page.goto('/launchpad');
    await page.waitForLoadState('networkidle');
    expect(appKitChunks).toHaveLength(0);
  });
});
