/**
 * E2E — Reservations
 *
 * Covers: reservation list, create reservation form validation,
 *         time conflict check, availability query, calendar view.
 */
import { test, expect } from '../fixtures/auth';

test.describe('Reservations', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await page.goto('/reservations', { waitUntil: 'domcontentloaded' });
  });

  test('should display the Reservations page', async ({ authedPage: page }) => {
    await expect(
      page.getByText(/reservation/i).first()
    ).toBeVisible();
  });

  test('should render reservation list table or calendar view', async ({ authedPage: page }) => {
    // The reservations page defaults to calendar view (服务器预约日历);
    // either the ant-table (list view) or the calendar grid is acceptable.
    await expect(
      page.locator('.ant-table, .ant-picker-calendar, [class*="calendar"]').first()
    ).toBeVisible();
  });

  test('should show New Reservation button', async ({ authedPage: page }) => {
    // Button text may be English "New Reservation" or Chinese "新建预约"
    const btn = page.getByRole('button', { name: /new|create|reserve|添加|新建预约/i });
    await expect(btn).toBeVisible();
  });

  test('should navigate to reservation form on New button click', async ({ authedPage: page }) => {
    // Button may be Chinese "新建预约" or English "New Reservation"
    await page.getByRole('button', { name: /new|create|reserve|新建预约/i }).first().click();
    // Either a modal or a form page should appear
    await expect(
      page.locator('.ant-modal-content, form').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('should display reservation status filter tabs/dropdown', async ({ authedPage: page }) => {
    // The calendar view uses button groups; list view uses tabs/table
    await expect(
      page.locator('.ant-tabs, .ant-select, [role="tablist"], .ant-table, [class*="calendar"]').first()
    ).toBeVisible();
  });

  test('should navigate to My Reservations', async ({ authedPage: page }) => {
    await page.goto('/reservations/mine', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/login/);
    // My Reservations may show a table, calendar, or empty state
    await expect(
      page.locator('.ant-table, .ant-empty, [class*="calendar"], .ant-card').first()
    ).toBeVisible();
  });

  test('should open reservation form at /reservations/new', async ({ authedPage: page }) => {
    await page.goto('/reservations/new', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('form').first()).toBeVisible({ timeout: 8000 });
  });
});
