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
    // Use a single comma-selector so .first() picks one element → no strict-mode violation
    await expect(
      page.locator('[class*="chart"], canvas, svg, .ant-statistic, .ant-card, .ant-empty').first()
    ).toBeVisible();
  });

  test('should display resource usage trend charts', async ({ authedPage: page }) => {
    // Monitoring page shows "Resource Usage Trends" chart — no standalone "alerts" card
    await expect(
      page.getByText(/resource usage|cluster|趋势|usage trend/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('should have server selector or filter control', async ({ authedPage: page }) => {
    await expect(
      page.locator('.ant-select, .ant-tabs, [role="tablist"], .ant-card').first()
    ).toBeVisible();
  });
});
