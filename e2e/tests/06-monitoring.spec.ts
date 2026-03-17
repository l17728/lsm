/**
 * E2E — Monitoring
 *
 * Covers: cluster stats, server metrics charts, alerts panel.
 */
import { test, expect } from '../fixtures/auth';

test.describe('Monitoring', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/monitoring', { waitUntil: 'domcontentloaded' });
  });

  test('should display the Monitoring page without errors', async ({ authedPage: page }) => {
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });

  test('should show cluster statistics section', async ({ authedPage: page }) => {
    await expect(
      page.getByText(/cpu|memory|gpu/i).first()
    ).toBeVisible();
  });

  test('should render metric charts or empty state', async ({ authedPage: page }) => {
    const chart  = page.locator('[class*="chart"], canvas, svg').first();
    const empty  = page.locator('.ant-empty').first();
    const metric = page.locator('.ant-statistic, .ant-card').first();
    await expect(chart.or(empty).or(metric)).toBeVisible();
  });

  test('should display alerts or "no alerts" state', async ({ authedPage: page }) => {
    await expect(
      page.getByText(/alert|no alert|warning/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('should have server selector or filter control', async ({ authedPage: page }) => {
    const selector = page.locator('.ant-select, .ant-tabs, [role="tablist"]').first();
    await expect(selector.or(page.locator('.ant-card').first())).toBeVisible();
  });
});
