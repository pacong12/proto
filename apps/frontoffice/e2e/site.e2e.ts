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

test.describe('Cookie choices', () => {
  test('a decline is remembered and consent can be withdrawn from the footer', async ({ page }) => {
    const gaRequests: string[] = [];
    await page.route('**/www.googletagmanager.com/**', (route) => {
      gaRequests.push(route.request().url());
      return route.fulfill({ contentType: 'application/javascript', body: '' });
    });
    const banner = page.getByRole('dialog', { name: /cookie consent/i });

    await page.goto('/launchpad');
    await banner.getByRole('button', { name: /decline/i }).click();
    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
    await expect(banner).toBeHidden();
    expect(gaRequests).toHaveLength(0);

    // Change of mind: accept from Cookie settings, then withdraw again.
    await page.getByRole('button', { name: 'Cookie settings' }).click();
    await banner.getByRole('button', { name: /accept/i }).click();
    await expect.poll(() => gaRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Cookie settings' }).click();
    await expect(banner).toContainText('You accepted analytics cookies.');
    await banner.getByRole('button', { name: /decline/i }).click();
    expect(
      await page.evaluate(() => localStorage.getItem('proto_cookie_consent_accepted_v1')),
    ).toBe('false');
    expect(await page.evaluate(() => document.cookie)).not.toMatch(/_ga/);
  });
});

test.describe('Terms acceptance', () => {
  const ADDRESS = '0x1111111111111111111111111111111111111111';

  test.beforeEach(async ({ page }) => {
    // A connected injected wallet; cookie choice answered so the banner stays out of the way.
    await page.addInitScript((address) => {
      localStorage.setItem('proto_cookie_consent_accepted_v1', 'false');
      localStorage.setItem('proto_wallet_connected', 'true');
      localStorage.setItem('proto_wallet_provider_id', 'injected');
      localStorage.setItem('proto_wallet_address', address);
      localStorage.setItem('proto_wallet_chain_id', '46630');
      (window as unknown as { ethereum: unknown }).ethereum = {
        isMetaMask: true,
        on() {},
        removeListener() {},
        request: async ({ method }: { method: string }) =>
          method === 'eth_accounts' || method === 'eth_requestAccounts'
            ? [address]
            : method === 'eth_chainId'
              ? '0xb626'
              : '0x0',
      };
    }, ADDRESS);
  });

  test('cannot be dismissed without a choice', async ({ page }) => {
    await page.goto('/launchpad');
    const dialog = page.getByRole('dialog', { name: /terms & privacy/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /close/i })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();

    await expect(dialog.getByRole('button', { name: /accept & continue/i })).toBeDisabled();
    await dialog.getByRole('switch').click();
    await dialog.getByRole('button', { name: /accept & continue/i }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await page.waitForTimeout(1500);
    await expect(dialog).toBeHidden();
  });

  test('declining disconnects the wallet', async ({ page }) => {
    await page.goto('/launchpad');
    const dialog = page.getByRole('dialog', { name: /terms & privacy/i });
    await dialog.getByRole('button', { name: /decline & disconnect/i }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('proto_wallet_connected')))
      .not.toBe('true');
    expect(
      await page.evaluate(() => localStorage.getItem('proto_privacy_policy_accepted_v1')),
    ).toBeNull();
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

  test('the first page stays within its JavaScript budget', async ({ page }) => {
    // Regression guard: all 11 locales and the RPC client (viem) used to ship in the entry chunk.
    const jsBytes: number[] = [];
    page.on('response', async (res) => {
      if (res.url().endsWith('.js'))
        jsBytes.push((await res.body().catch(() => Buffer.alloc(0))).length);
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const total = jsBytes.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(800_000);
  });
});

test.describe('Languages', () => {
  test('a saved non-English locale is loaded on demand and rendered', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('proto_selected_locale_v1', 'id'));
    await page.goto('/launchpad');
    await expect(page.getByRole('link', { name: 'Jelajahi' }).first()).toBeVisible();
  });
});
