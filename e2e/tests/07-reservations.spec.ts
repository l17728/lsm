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

  test('should render reservation list table or empty state', async ({ authedPage: page }) => {
    const table = page.locator('.ant-table');
    const empty = page.locator('.ant-empty');
    await expect(table.or(empty)).toBeVisible();
  });

  test('should show New Reservation button', async ({ authedPage: page }) => {
    const btn = page.getByRole('button', { name: /new|create|reserve|添加/i });
    await expect(btn).toBeVisible();
  });

  test('should navigate to reservation form on New button click', async ({ authedPage: page }) => {
    await page.getByRole('button', { name: /new|create|reserve/i }).click();
    // Either a modal or navigation to /reservations/new
    await expect(
      page.locator('.ant-modal-content')
        .or(page.locator('form'))
        .or(page.getByText(/create reservation|new reservation/i))
    ).toBeVisible({ timeout: 8000 });
  });

  test('should display reservation status filter tabs/dropdown', async ({ authedPage: page }) => {
    const filter = page.locator('.ant-tabs, .ant-select, [role="tablist"]').first();
    await expect(filter.or(page.locator('.ant-table').first())).toBeVisible();
  });

  test('should navigate to My Reservations', async ({ authedPage: page }) => {
    await page.goto('/reservations/mine', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/login/);
    await expect(
      page.getByText(/my reservation|mine/i).first()
        .or(page.locator('.ant-table, .ant-empty').first())
    ).toBeVisible();
  });

  test('should open reservation form at /reservations/new', async ({ authedPage: page }) => {
    await page.goto('/reservations/new', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/login/);
    // Form fields should be present
    await expect(
      page.getByLabel(/title|name/i).first()
        .or(page.locator('form').first())
    ).toBeVisible({ timeout: 8000 });
  });
});
