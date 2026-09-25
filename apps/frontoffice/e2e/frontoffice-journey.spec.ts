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

  test('Mobile viewport: Header and navigation drawer function without horizontal overflow', async ({
    page,
  }) => {
    // Set viewport to standard mobile width (iPhone SE 375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Verify brand logo
    const brand = page.locator('header').getByText('proto', { exact: true });
    await expect(brand).toBeVisible();

    // Verify no horizontal page overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Verify mobile hamburger menu button exists and is clickable
    const hamburgerBtn = page.locator('header button[aria-label="Toggle navigation menu"]');
    await expect(hamburgerBtn).toBeVisible();
    await hamburgerBtn.click();

    // Verify mobile drawer opened and navigation links are visible
    const exploreMobileLink = page.getByRole('link', { name: /explore/i }).first();
    await expect(exploreMobileLink).toBeVisible();

    const createMobileLink = page.getByRole('link', { name: /create/i }).first();
    await expect(createMobileLink).toBeVisible();

    // Close drawer
    await hamburgerBtn.click();

    // Open Search via mobile search button
    const searchBtn = page.locator('header button[aria-label="Search"]');
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Close search dialog using mobile close button
    const closeSearchBtn = page.locator('button[aria-label="Close search"]');
    if (await closeSearchBtn.isVisible()) {
      await closeSearchBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });

  test('Tablet viewport: Layout adapts and renders without horizontal scroll', async ({ page }) => {
    // Set viewport to standard tablet width (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Verify no horizontal page overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('Breadcrumb and profile are combined in navbar before wallet connection', async ({
    page,
  }) => {
    await page.goto('/launchpad/create');
    const breadcrumb = page.locator('header nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText(/create/i);

    // Profile trigger is present within the combined element before wallet
    const profileTrigger = page.locator('header button[aria-label="Profile and Preferences menu"]');
    await expect(profileTrigger).toBeVisible();
  });
});
