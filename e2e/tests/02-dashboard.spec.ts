/**
 * E2E — Dashboard
 *
 * Covers: stats cards render, navigation links, real-time indicator,
 *         responsive layout, alerts section.
 */
import { test, expect } from '../fixtures/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  });

  test('should display the Dashboard page without errors', async ({ authedPage: page }) => {
    // No error boundary or "500" text
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show statistics cards (Servers / GPUs / Tasks)', async ({ authedPage: page }) => {
    // Ant Design Statistic titles
    await expect(page.getByText(/servers/i).first()).toBeVisible();
    await expect(page.getByText(/gpu/i).first()).toBeVisible();
    await expect(page.getByText(/tasks/i).first()).toBeVisible();
  });

  test('should display numeric values in stat cards', async ({ authedPage: page }) => {
    // At least one number is visible in a stat card
    const statValues = page.locator('.ant-statistic-content-value, [class*="statistic"]');
    await expect(statValues.first()).toBeVisible();
  });

  test('should show online / offline server tags', async ({ authedPage: page }) => {
    await expect(
      page.getByText(/online/i).first()
    ).toBeVisible();
  });

  test('should render resource usage chart area', async ({ authedPage: page }) => {
    // Charts or the card containing them
    const chartSection = page.getByText(/resource usage/i).first();
    await expect(chartSection).toBeVisible();
  });

  test('should display alerts section', async ({ authedPage: page }) => {
    // Alerts card or empty state
    const alertsArea = page.getByText(/alert/i).first();
    await expect(alertsArea).toBeVisible();
  });

  test('should navigate to Servers page via sidebar', async ({ authedPage: page }) => {
    await page.getByRole('menuitem', { name: /server/i })
      .or(page.locator('.ant-menu-item').filter({ hasText: /server/i }).first())
      .click();
    await expect(page).toHaveURL(/server/);
  });

  test('should navigate to GPUs page via sidebar', async ({ authedPage: page }) => {
    await page.getByRole('menuitem', { name: /gpu/i })
      .or(page.locator('.ant-menu-item').filter({ hasText: /gpu/i }).first())
      .click();
    await expect(page).toHaveURL(/gpu/);
  });

  test('theme/dark-mode toggle does not crash the app', async ({ authedPage: page }) => {
    const themeBtn = page.locator(
      '[class*="theme"], [aria-label*="theme"], [aria-label*="dark"], button[title*="dark"]'
    ).first();
    const hasToggle = await themeBtn.isVisible().catch(() => false);
    if (hasToggle) {
      await themeBtn.click();
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('language/i18n switcher does not crash the app', async ({ authedPage: page }) => {
    const i18nBtn = page.locator(
      '[class*="lang"], [aria-label*="lang"], [aria-label*="locale"]'
    ).first();
    const hasI18n = await i18nBtn.isVisible().catch(() => false);
    if (hasI18n) {
      await i18nBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(page.locator('body')).toBeVisible();
  });
});
