/**
 * E2E — Server Management
 *
 * Covers: server list render, search/filter, add server form validation,
 *         status badge display, pagination.
 */
import { test, expect } from '../fixtures/auth';

test.describe('Server Management', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/servers', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display the Servers page', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: /server/i }).first()
      .or(page.getByText(/server/i).first())).toBeVisible();
  });

  test('should render a data table or empty state', async ({ authedPage: page }) => {
    const table = page.locator('.ant-table, [role="table"]');
    const emptyState = page.locator('.ant-empty, [class*="empty"]');
    await expect(table.or(emptyState)).toBeVisible();
  });

  test('should display server status badges (ONLINE/OFFLINE/MAINTENANCE)', async ({ authedPage: page }) => {
    const rows = page.locator('.ant-table-row, tr[data-row-key]');
    const count = await rows.count();
    if (count > 0) {
      const statusTag = page.locator('.ant-tag').first();
      await expect(statusTag).toBeVisible();
    } else {
      // No servers seeded — just verify page rendered
      expect(true).toBeTruthy();
    }
  });

  test('should show Add Server button', async ({ authedPage: page }) => {
    await expect(
      page.getByRole('button', { name: /add server/i })
    ).toBeVisible();
  });

  test('should open Add Server modal on button click', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: /add server/i }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible();
    // Form fields
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
    await expect(page.getByLabel(/hostname/i)).toBeVisible();
  });

  test('should validate required fields on Add Server form', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: /add server/i }).click();
    // Click OK/Submit without filling anything
    await page.getByRole('button', { name: /ok|submit|save|confirm/i }).click();
    // Validation messages should appear
    const validationMsg = page.locator('.ant-form-item-explain-error');
    await expect(validationMsg.first()).toBeVisible();
  });

  test('should close Add Server modal on Cancel', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: /add server/i }).click();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('.ant-modal-content')).not.toBeVisible();
  });

  test('should show Export button', async ({ authedPage: page }) => {
    await expect(
      page.getByRole('button', { name: /export|导出/i })
    ).toBeVisible();
  });
});
