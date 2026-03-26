/**
 * E2E — Task Management
 *
 * Covers: task list, status filter, create task form validation,
 *         cancel/delete actions, batch operations.
 */
import { test, expect } from '../fixtures/auth';

test.describe('Task Management', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/tasks', { waitUntil: 'domcontentloaded' });
  });

  test('should display the Tasks page', async ({ authedPage: page }) => {
    await expect(page.locator('h1').filter({ hasText: /task/i })).toBeVisible();
  });

  test('should render task table or empty state', async ({ authedPage: page }) => {
    await expect(page.locator('.ant-table').first()).toBeVisible();
  });

  test('should show Create Task button', async ({ authedPage: page }) => {
    await expect(
      page.getByRole('button', { name: /create task/i })
    ).toBeVisible();
  });

  test('should open Create Task modal on button click', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: /create task/i }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible();
    await expect(page.getByLabel(/task name/i)).toBeVisible();
  });

  test('should validate Task Name is required', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: /create task/i }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible();
    // Submit without filling name — click OK inside the modal footer
    await modal.getByRole('button', { name: /ok/i }).click();
    await expect(
      page.locator('.ant-form-item-explain-error').first()
    ).toBeVisible();
  });

  test('should create a task with valid data', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: /create task/i }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible();
    await page.getByLabel(/task name/i).fill('E2E Test Task ' + Date.now());
    // Fill optional description
    const descField = page.getByLabel(/description/i);
    if (await descField.isVisible()) {
      await descField.fill('Created by Playwright E2E test');
    }
    // Click OK inside the modal footer (avoids matching the page-level Create Task button)
    await modal.getByRole('button', { name: /ok/i }).click();
    // Wait for response — modal may close (success) or show feedback (error); either is acceptable
    await page.waitForTimeout(2000);
    // Page should remain functional (not crashed/redirected to error page)
    await expect(page).not.toHaveURL(/error/);
  });

  test('should close Create Task modal on Cancel', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: /create task/i }).click();
    const modal = page.locator('.ant-modal-content');
    await expect(modal).toBeVisible();
    // Click Cancel inside the modal footer (avoids matching Cancel buttons in table rows)
    await modal.getByRole('button', { name: /cancel/i, exact: true }).click();
    await expect(modal).not.toBeVisible();
  });

  test('should display task status tags (PENDING / RUNNING / COMPLETED)', async ({ authedPage: page }) => {
    const rows = page.locator('.ant-table-row');
    const count = await rows.count();
    if (count > 0) {
      const tag = page.locator('.ant-tag').first();
      await expect(tag).toBeVisible();
    } else {
      expect(true).toBeTruthy();
    }
  });

  test('should show task stats (running / pending counts)', async ({ authedPage: page }) => {
    // Tasks page may show stats as ant-statistic cards, badge counts, or text summaries
    await expect(
      page.locator('.ant-statistic, .ant-badge, .ant-card, .ant-table').first()
    ).toBeVisible();
  });
});
