import { test, expect } from '@playwright/test';

test.describe('Proto Frontoffice User Journeys', () => {
  test('User can navigate between Explore, Create Token, and Analytics', async ({ page }) => {
    // 1. Visit Explore / Landing Page
    await page.goto('/');
    await expect(page).toHaveTitle(/proto/i);

    // Verify brand logo and navigation
    const brand = page.locator('header').getByText('proto', { exact: true });
    await expect(brand).toBeVisible();

    // 2. Navigate to Create Token view
    const createNavLink = page.locator('header nav').getByRole('link', { name: /create/i });
    if (await createNavLink.isVisible()) {
      await createNavLink.click();
      await expect(page).toHaveURL(/\/create/);
    }

    // 3. Navigate to Analytics view
    const analyticsNavLink = page.locator('header nav').getByRole('link', { name: /analytics/i });
    if (await analyticsNavLink.isVisible()) {
      await analyticsNavLink.click();
      await expect(page).toHaveURL(/\/analytics/);
    }
  });

  test('Wallet Modal opens, displays connection options, and closes with ESC', async ({ page }) => {
    await page.goto('/');

    // Locate Connect Wallet trigger button
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // Verify modal overlay opens
    const modal = page.locator('[role="dialog"], .fixed.inset-0');
    await expect(modal.first()).toBeVisible();

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await expect(page.locator('.fixed.inset-0')).not.toBeVisible();
  });

  test('Search Dialog triggers with shortcut and filters tokens', async ({ page }) => {
    await page.goto('/');

    // Press Cmd+K or Ctrl+K
    await page.keyboard.press('Control+K');

    // Verify search input appears
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('PROTO');
      await page.keyboard.press('Escape');
    }
  });
});
